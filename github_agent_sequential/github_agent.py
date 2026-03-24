#!/usr/bin/env python3
# ============================================================================
# Version: 0.2
# Created by: Gangavarapu Lakshmi Dhatri
# Date: November 04, 2025
# Description: GitHub Agent - Main Entry Point with Single-Endpoint Confirmation
# ============================================================================

import os
from flask import Flask, request, jsonify
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, Session
from google.genai import types
import uuid
import logging
import asyncio
from functools import wraps
import time
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import your agent from the other file
from agent.agent import github_agent, confirmed_actions, create_stable_action_key

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# --- Environment Configuration ---
# API Authentication
API_KEY = os.getenv("API_KEY")

# Flask Configuration
FLASK_PORT = int(os.getenv("FLASK_PORT"))

# Agent Configuration
APP_NAME = os.getenv("APP_NAME")
AGENT_ENDPOINT = os.getenv("AGENT_ENDPOINT")
HEALTH_CHECK_ENDPOINT = os.getenv("HEALTH_CHECK_ENDPOINT")
AGENT_HOST = os.getenv("AGENT_HOST")

def require_auth(f):
    """Decorator to require valid API key authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if API_KEY is configured
        if not API_KEY:
            logging.error("API_KEY not configured in environment variables")
            return jsonify({
                "error": "Server configuration error. API key not configured."
            }), 500
        
        # Get Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            logging.warning("Missing Authorization header")
            return jsonify({
                "error": "Authorization header is required",
                "message": "Please provide a valid Bearer token in the Authorization header"
            }), 401
        
        # Check if it's a Bearer token
        if not auth_header.startswith('Bearer '):
            logging.warning("Invalid Authorization header format")
            return jsonify({
                "error": "Invalid Authorization header format",
                "message": "Authorization header must start with 'Bearer '"
            }), 401
        
        # Extract the token
        token = auth_header.split(' ')[1] if len(auth_header.split(' ')) > 1 else None
        
        if not token:
            logging.warning("Empty token provided")
            return jsonify({
                "error": "Empty token provided",
                "message": "Please provide a valid Bearer token"
            }), 401
        
        # Verify the token
        if token != API_KEY:
            logging.warning(f"Invalid token provided: {token[:10]}...")
            return jsonify({
                "error": "Invalid API key",
                "message": "The provided API key is not valid"
            }), 401
        
        logging.info("Valid API key provided")
        return f(*args, **kwargs)
    
    return decorated_function

session_service = InMemorySessionService()
runner = Runner(
    agent=github_agent,
    app_name=APP_NAME,
    session_service=session_service,
)

async def handle_request_async(session_id, user_id, app_name, query, confirm_action=None):
    """
    Handles all async operations for a request within a single event loop.
    """
    # 1. Ensure the session exists
    session = await session_service.get_session(
        session_id=session_id, user_id=user_id, app_name=app_name
    )
    if not session:
        logging.info(f"Session {session_id} not found in service. Creating it now.")
        await session_service.create_session(session_id=session_id, user_id=user_id, app_name=app_name)

    # 2. Handle confirmation if provided
    if confirm_action:
        # The action key comes directly from the response
        action_key = confirm_action
        confirmed_actions.add(action_key)
        logging.info(f"✅ Action confirmed: {action_key}")
        logging.info(f"📝 Current confirmed actions: {confirmed_actions}")

    # 3. Run the agent
    final_response_text = []
    new_message = types.Content(role="user", parts=[types.Part(text=query)])
    
    try:
        async for event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=new_message
        ):                
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        final_response_text.append({
                            "type": "tool_request",
                            "name": part.function_call.name,
                            "arguments": part.function_call.args,
                            "timestamp": time.time()
                        })

                    elif hasattr(part, 'function_response') and part.function_response:
                        response_data = part.function_response.response
                        
                        # Check if this is a permission required response
                        if isinstance(response_data, dict) and response_data.get("error") == "PERMISSION_REQUIRED":
                            final_response_text.append({
                                "type": "permission_required",
                                "action": response_data.get("action"),
                                "action_key": response_data.get("action_key"),
                                "message": response_data.get("message"),
                                "confirmation_example": {
                                    "user_id": user_id,
                                    "session_id": session_id,
                                    "query": query,
                                    "confirm_action": response_data.get("action_key")
                                },
                                "timestamp": time.time()
                            })
                        else:
                            # Try to extract result from response
                            result = response_data
                            if isinstance(response_data, dict) and 'result' in response_data:
                                result = response_data['result']
                            
                            final_response_text.append({
                                "type": "tool_response",
                                "result": str(result),
                                "timestamp": time.time()
                            })

                    elif hasattr(part, 'text') and part.text:
                        final_response_text.append({
                            "type": "agent_response",
                            "text": part.text,
                            "timestamp": time.time()
                        })
    except Exception as e:
        logging.error(f"Error during agent execution: {e}")
        import traceback
        traceback.print_exc()
        final_response_text = [{
            "type": "error",
            "message": f"An error occurred: {e}",
            "timestamp": time.time()
        }]

    return final_response_text


@app.route(HEALTH_CHECK_ENDPOINT, methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "agent": "github_agent",
        "app_name": APP_NAME,
        "authentication": "Bearer token required for /github_agent endpoint",
        "capabilities": [
            "GitHub operations (repos, issues, PRs, branches)",
            "Permission control for sensitive actions"
        ],
        "usage": {
            "initial_request": {
                "user_id": "your_user_id",
                "query": "create an issue in repo owner/repo with title 'Bug Fix'"
            },
            "confirmation_request": {
                "user_id": "your_user_id",
                "session_id": "session_from_initial_response",
                "query": "create an issue in repo owner/repo with title 'Bug Fix'",
                "confirm_action": "action_key_from_initial_response"
            }
        }
    }), 200

@app.route(AGENT_ENDPOINT, methods=["POST"])
@require_auth
def run_agent():
    """Handles POST requests to run the GitHub ADK agent with optional confirmation."""
    data = request.json
    user_id = data.get("user_id")
    query = data.get("query")
    session_id = data.get("session_id")
    confirm_action = data.get("confirm_action")  # Optional: action key to confirm

    if not user_id or not query:
        return jsonify({"error": "Missing 'user_id' or 'query' field."}), 400

    if not session_id:
        session_id = str(uuid.uuid4())
        logging.info(f"Request missing session_id. Generated new one: {session_id}")

    # Log if this is a confirmation request
    if confirm_action:
        logging.info(f"🔐 Confirmation request received for action: {confirm_action}")

    try:
        response_text = asyncio.run(
            handle_request_async(session_id, user_id, APP_NAME, query, confirm_action)
        )
        
        response_obj = {
            "response": response_text,
            "session_id": session_id
        }
        
        # If confirmation was provided, add confirmation status
        if confirm_action:
            response_obj["confirmed"] = True
            response_obj["confirmed_action"] = confirm_action
        
        return jsonify(response_obj)
    except Exception as e:
        logging.error(f"An error occurred in the request handler: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logging.info(f"\n{'='*60}")
    logging.info(f"🚀 Starting GitHub Agent Flask server")
    logging.info(f"{'='*60}")
    logging.info(f"🌐 Port: {FLASK_PORT}")
    logging.info(f"📍 Endpoint: POST /github_agent")
    logging.info(f"💡 Single endpoint handles both requests and confirmations")
    logging.info(f"🔒 Use 'confirm_action' field for sensitive action confirmation")
    logging.info(f"{'='*60}\n")
    app.run(host=AGENT_HOST, port=FLASK_PORT)