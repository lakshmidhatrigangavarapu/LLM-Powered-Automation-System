# GitHub Agent with MCP Server

**Created by:** Gangavarapu Lakshmi Dhatri  

A modular **GitHub automation assistant** integrated with **Model Context Protocol (MCP) server** for GitHub operations.  
It allows natural-language interaction with GitHub for actions like creating repositories, issues, and pull requests.

---

## Overview

Use plain English to automate GitHub tasks such as:

- "Create an issue titled _Fix login bug_ in repository `demo-repo`."
- "Create a pull request from `feature/login` to `main`."
- "List all open issues assigned to me."

---

## Prerequisites

Make sure the following are installed:

- **Python 3.8+** (Python 3.12+ recommended)  
- **Node.js 16+**

---

## Project Structure

```
github_agent_sequential/
│
├── agent/                           # Core agent logic
│   ├── __init__.py
│   └── agent.py
│
├── servers/                         # MCP servers
│   └── github/                      # GitHub MCP server
│       ├── dist/
│       ├── package.json
│       ├── Dockerfile               # Docker config for MCP server
│       └── .env
│
├── utils.py                         # Utility functions
├── github_agent.py                  # Main Flask-based entrypoint
├── Dockerfile                       # Docker config for agent
├── requirements.txt                 # Python dependencies
├── server.logs                      # Logs for debugging
└── README.md                        # Project documentation
```

---

## Setup & Installation

### 1. Navigate to the Project Directory

```bash
cd ~/Downloads/github_agent_sequential
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Setup

**No need to set .env variables each time** — they are already configured.  
If needed, update your `.env` file in the project root directory.

### 4. Start the GitHub MCP Server

#### Run GitHub MCP Server

Open a terminal and run:

```bash
cd servers/github
node dist/index.js
```

**Expected Output:**

```
GitHub MCP Server running on HTTP port 9001
SSE endpoint: http://localhost:9001/sse
Message endpoint: http://localhost:9001/message
```

### 5. Start the GitHub Agent

Open another terminal and run:

```bash
python github_agent.py
```

**Example Output:**

```
INFO:root:🤖 Selected agent: GitHub_gemini_flash_agent
INFO:root:
============================================================
INFO:root:🐙 GitHub Agent Initialized
INFO:root:============================================================
INFO:root:📦 GitHub MCP: http://localhost:9001/sse
INFO:root:🔒 Sensitive actions: create_issue, create_pull_request
INFO:root:============================================================
INFO:root:
============================================================
INFO:root:🚀 Starting GitHub Agent Flask server
INFO:root:============================================================
INFO:root:🌐 Port: 5001
INFO:root:📍 Endpoint: POST /github_agent
INFO:root:💡 Single endpoint handles both requests and confirmations
INFO:root:🔒 Use 'confirm_action' field for sensitive action confirmation
INFO:root:============================================================
 * Running on http://127.0.0.1:5001
 * Running on http://172.20.10.4:5001
```

Your GitHub Agent will be available at:

```
http://localhost:5001/github_agent
```

---

## Agent Workflow

### Confirmation System

- **Sensitive Actions** (e.g., creating issues, pull requests) require confirmation.
- **Non-sensitive Actions** (e.g., listing repositories or branches) execute immediately.
- Each sensitive action generates a unique `confirm_action` key (SHA-based).

### Workflow Example

#### 1️ Initial Request

```json
{
  "userid": "user_001",
  "query": "create an issue in repo 'demo-repo' titled 'Fix login error'"
}
```

**Response:**

```json
{
  "message": "Please confirm this action",
  "confirm_action": "create_issue_6a9fbc3d"
}
```

#### 2️ Confirmation Request

```json
{
  "userid": "user_001",
  "query": "create an issue in repo 'demo-repo' titled 'Fix login error'",
  "confirm_action": "create_issue_6a9fbc3d"
}
```

---

## API Testing Guide

### API Endpoint

```
POST http://localhost:5001/github_agent
```

### Headers

```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

### Example Non-Sensitive Actions

#### Create Repository

```json
{
  "userid": "user_001",
  "query": "create a new repository called 'demo-helper'"
}
```

#### Create Branch

```json
{
  "userid": "user_001",
  "query": "create a branch called 'feature-auth' in repo 'demo-helper'"
}
```

---

## 🛠️ Available GitHub Tools

| Tool                  | Description                      |
| --------------------- | -------------------------------- |
| `create_repository`   | Create a new GitHub repository   |
| `create_issue`        | Create new issues (sensitive)    |
| `create_pull_request` | Create pull requests (sensitive) |
| `fork_repository`     | Fork an existing repository      |
| `create_branch`       | Create new branches              |
| `list_issues`         | List issues in a repository      |
| `update_issue`        | Update existing issues           |
| `search_issues`       | Search for issues or PRs         |
| `merge_pull_request`  | Merge pull requests              |

---

## Author

**Gangavarapu Lakshmi Dhatri** 

---

## Acknowledgments

- Model Context Protocol (MCP) for enabling modular server integration
- GitHub API for powering automation
- Flask for the lightweight web framework
