import asyncio
import json
import logging
import datetime
import os
from typing import Optional, Dict
from dotenv import load_dotenv

from flask import Flask, request, jsonify
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioConnectionParams, StreamableHTTPConnectionParams
from google.adk.models import LlmResponse, LlmRequest
from google.genai import types
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, Session
import uuid
import hashlib

# Load environment variables from .env file
load_dotenv()

# Set up logging for the ADK Runner to see detailed events
logging.basicConfig(level=logging.INFO)

# --- Environment Configuration ---
# API Authentication
API_KEY = os.getenv("API_KEY")

# Flask Configuration
FLASK_PORT = int(os.getenv("FLASK_PORT"))

# LLM Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER")
LLM_MODEL = os.getenv("LLM_MODEL")
LLM_API_BASE = os.getenv("LLM_API_BASE")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "300"))

# MCP Configuration - GitHub (HTTP)
MCP_HTTP_URL = os.getenv("MCP_HTTP_URL")
GITHUB_PAT = os.getenv("GITHUB_PAT")

# Token Management
MAX_TOKEN_COUNT = int(os.getenv("MAX_TOKEN_COUNT"))

# Agent Configuration
AGENT_NAME = os.getenv("AGENT_NAME")
APP_NAME = os.getenv("APP_NAME")

OPENAI_MODEL = os.getenv("OPENAI_MODEL")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL")
GEMINI_FLASH_MODEL = os.getenv("GEMINI_FLASH_MODEL")
GEMINI_PRO_MODEL = os.getenv("GEMINI_PRO_MODEL")

# GitHub-specific Configuration
SENSITIVE_ACTIONS = {
    "create_issue",
    "create_pull_request",
}

# --- Global state and callbacks ---
total_token_count = 0
confirmed_actions = set()

def model_count(
    llm_response: LlmResponse, callback_context: any
) -> Optional[Dict]:
    """
    Displays tokens used for generation.
    """
    global total_token_count
    try:
        usage_metadata = llm_response.usage_metadata
        logging.info(f'Response usage metadata: {usage_metadata}')
        logging.info(f'Candidate response: {usage_metadata.candidates_token_count}')
        logging.info(f'Total count for this request: {usage_metadata.total_token_count}')
        response_count = usage_metadata.total_token_count
        total_token_count += response_count
        logging.info(f'Cumulative total count: {total_token_count}')
    except Exception as e:
        logging.error(f"Error in after_model_callback: {e}")

def exceeded_token_limit(
        callback_context: any, llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    """
    Checks if token limit exceeded and returns error response.
    """
    global total_token_count
    logging.info(f'Current total token count: {total_token_count}')

    if total_token_count > MAX_TOKEN_COUNT:
        logging.warning('TOKEN LIMIT EXCEEDED!')
        return LlmResponse(
            content=types.Content(
                role="model",
                parts=[
                    types.Part(
                        text="Token limit exceeded. Please try again tomorrow or consider upgrading."
                    )
                ],
            )
        )

def create_stable_action_key(tool_name, args):
    """
    Create a deterministic SHA256 hash key for an action.
    This ensures the same action with same arguments generates the same key.
    """
    args_str = json.dumps(args, sort_keys=True)
    sha = hashlib.sha256(args_str.encode()).hexdigest()
    action_key = f"{tool_name}_{sha}"
    logging.info(f"🔑 Generated action key: {action_key}")
    return action_key

def before_tool_callback(tool, args, tool_context):
    """
    Intercepts tool calls before execution to implement permission control.
    Blocks sensitive GitHub actions until user explicitly confirms them.
    """
    try:
        tool_name = tool.name
        
        # Check if this is a sensitive action
        if tool_name in SENSITIVE_ACTIONS:
            action_key = create_stable_action_key(tool_name, args)
            
            logging.info(f"🔍 Checking sensitive action: {tool_name}")
            logging.info(f"🔑 Action key: {action_key}")
            logging.info(f"📝 Confirmed actions: {confirmed_actions}")
            
            # If already confirmed, allow execution
            if action_key in confirmed_actions:
                logging.info(f"✅ Action {tool_name} already confirmed, proceeding...")
                return None
            
            # Otherwise, block and request confirmation
            else:
                logging.warning(f"⚠️ Sensitive action {tool_name} requires confirmation")
                
                # Format the details nicely
                details = []
                if 'owner' in args:
                    details.append(f"Owner: {args['owner']}")
                if 'repo' in args:
                    details.append(f"Repository: {args['repo']}")
                if 'title' in args:
                    details.append(f"Title: {args['title']}")
                if 'body' in args:
                    body = args['body']
                    if len(body) > 100:
                        body = body[:100] + '...'
                    details.append(f"Body: {body}")
                if 'head' in args:
                    details.append(f"Source Branch: {args['head']}")
                if 'base' in args:
                    details.append(f"Target Branch: {args['base']}")
                
                details_str = '\n'.join(details)
                
                return {
                    "error": "PERMISSION_REQUIRED",
                    "message": (
                        f"⚠️ Permission Required\n\n"
                        f"Action: {tool_name}\n"
                        f"{details_str}\n\n"
                        f"To proceed, send the same request with:\n"
                        f'  "confirm_action": "{action_key}"'
                    ),
                    "action": tool_name,
                    "action_key": action_key,
                    "args": args,
                    "status": "awaiting_confirmation"
                }
        
        # Non-sensitive actions proceed without confirmation
        return None
        
    except Exception as e:
        logging.error(f"Error in before_tool_callback: {e}")
        import traceback
        traceback.print_exc()
        return None

# GitHub Agent Instruction
GITHUB_AGENT_INSTRUCTION = """
You are an intelligent GitHub assistant with access to GitHub operations.

You have access to **GitHub MCP Tools** for interacting with GitHub repositories:
   - Managing issues and pull requests
   - Working with branches and commits
   - Triggering and monitoring workflows/actions
   - Accessing repository information
   - Managing repository files and structure
   - User and organization operations

**Operational Guidelines:**

- Execute non-sensitive operations immediately
- For sensitive actions (creates, deletes, merges), wait for user confirmation
- If you receive 'PERMISSION_REQUIRED' error, output ONLY: "Permission required. User must confirm."
- Provide clear explanations of actions taken
- Think through complex tasks step by step before executing

**Response Format:**
- Be concise and clear
- Provide context for actions taken
- Include relevant GitHub URLs when helpful
- Structure responses for readability

**Error Handling:**
- Always check tool responses for errors
- Provide helpful suggestions when operations fail
- Guide users through permission requirements
- Explain what went wrong and how to fix it

**IMPORTANT:** 
- Always return responses in plain text format as if conversing with a human
- NEVER output JSON format
- NEVER output a JSON object
- Be helpful, accurate, and thorough in your responses
"""

def get_toolset():
    """
    Returns GitHub MCP toolset.
    """
    # Build headers for GitHub MCP
    github_headers = {}
    if GITHUB_PAT:
        github_headers["Authorization"] = f"Bearer {GITHUB_PAT}"
    
    return [
        # GitHub MCP Server (HTTP)
        MCPToolset(
            connection_params=StreamableHTTPConnectionParams(
                url=MCP_HTTP_URL,
                headers=github_headers
            )
        )
    ]

def build_github_agent() -> LlmAgent:
    """
    Construct and return the selected LLM agent based on AGENT_NAME.
    Defaults to 'gemini-flash' when AGENT_NAME is not set.
    """

    openai_agent = LlmAgent(
        name="GitHub_openai_agent",
        model=LiteLlm(
            provider="openai",
            model=OPENAI_MODEL,
            api_key=os.getenv("OPENAI_API_KEY"),
            force_json=False,
        ),
        instruction=GITHUB_AGENT_INSTRUCTION,
        tools=get_toolset(),
        before_tool_callback=before_tool_callback
    )

    claude_agent = LlmAgent(
        name="GitHub_claude_agent",
        model=LiteLlm(
            provider="anthropic",
            model=CLAUDE_MODEL,
            api_key=os.getenv("CLAUDE_API_KEY"),
            force_json=False,
        ),
        instruction=GITHUB_AGENT_INSTRUCTION,
        tools=get_toolset(),
        before_tool_callback=before_tool_callback
    )

    gemini_flash_agent = LlmAgent(
        name="GitHub_gemini_flash_agent",
        model=GEMINI_FLASH_MODEL,
        instruction=GITHUB_AGENT_INSTRUCTION,
        tools=get_toolset(),
        before_tool_callback=before_tool_callback
    )

    gemini_agent = LlmAgent(
        name="GitHub_gemini_agent",
        model=GEMINI_PRO_MODEL,
        instruction=GITHUB_AGENT_INSTRUCTION,
        tools=get_toolset(),
        before_tool_callback=before_tool_callback
    )

    # Pick from env
    agent_name = os.getenv("AGENT_NAME", "gemini-flash").lower().strip()
    agent_map = {
        "openai": openai_agent,
        "claude": claude_agent,
        "gemini": gemini_agent,
        "gemini-flash": gemini_flash_agent,
    }
    
    selected_agent = agent_map.get(agent_name, gemini_flash_agent)
    logging.info(f"🤖 Selected agent: {selected_agent.name}")
    return selected_agent

# Expose the selected agent under the expected name
github_agent = build_github_agent()

logging.info(f"\n{'='*60}")
logging.info(f"🐙 GitHub Agent Initialized")
logging.info(f"{'='*60}")
logging.info(f"📦 GitHub MCP: {MCP_HTTP_URL}")
logging.info(f"🔒 Sensitive actions: {', '.join(SENSITIVE_ACTIONS)}")
logging.info(f"{'='*60}\n")


#title-generation code

