#!/usr/bin/env node
import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from 'node:http';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import fetch, { Request, Response } from 'node-fetch';

import * as repository from './operations/repository.js';
import * as files from './operations/files.js';
import * as issues from './operations/issues.js';
import * as pulls from './operations/pulls.js';
import * as branches from './operations/branches.js';
import * as search from './operations/search.js';
import * as commits from './operations/commits.js';
import {
  GitHubError,
  GitHubValidationError,
  GitHubResourceNotFoundError,
  GitHubAuthenticationError,
  GitHubPermissionError,
  GitHubRateLimitError,
  GitHubConflictError,
  isGitHubError,
} from './common/errors.js';
import { VERSION } from "./common/version.js";

// If fetch doesn't exist in global scope, add it
if (!globalThis.fetch) {
  globalThis.fetch = fetch as unknown as typeof global.fetch;
}

const server = new Server(
  {
    name: "github-mcp-server",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function formatGitHubError(error: GitHubError): string {
  let message = `GitHub API Error: ${error.message}`;
  
  if (error instanceof GitHubValidationError) {
    message = `Validation Error: ${error.message}`;
    if (error.response) {
      message += `\nDetails: ${JSON.stringify(error.response)}`;
    }
  } else if (error instanceof GitHubResourceNotFoundError) {
    message = `Not Found: ${error.message}`;
  } else if (error instanceof GitHubAuthenticationError) {
    message = `Authentication Failed: ${error.message}`;
  } else if (error instanceof GitHubPermissionError) {
    message = `Permission Denied: ${error.message}`;
  } else if (error instanceof GitHubRateLimitError) {
    message = `Rate Limit Exceeded: ${error.message}\nResets at: ${error.resetAt.toISOString()}`;
  } else if (error instanceof GitHubConflictError) {
    message = `Conflict: ${error.message}`;
  }

  return message;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      //{
        //name: "create_or_update_file",
        //description: "Create or update a single file in a GitHub repository",
        //inputSchema: zodToJsonSchema(files.CreateOrUpdateFileSchema),
      //},
      /*{
        name: "search_repositories",
        description: "Search for GitHub repositories",
        inputSchema: zodToJsonSchema(repository.SearchRepositoriesSchema),
      },*/
      {
        name: "create_repository",
        description: "Create a new GitHub repository in your account",
        inputSchema: zodToJsonSchema(repository.CreateRepositoryOptionsSchema),
      },
      /*{
        name: "get_file_contents",
        description: "Get the contents of a file or directory from a GitHub repository",
        inputSchema: zodToJsonSchema(files.GetFileContentsSchema),
      },
      {
        name: "push_files",
        description: "Push multiple files to a GitHub repository in a single commit",
        inputSchema: zodToJsonSchema(files.PushFilesSchema),
      },*/
      {
        name: "create_issue",
        description: "Create a new issue in a GitHub repository",
        inputSchema: zodToJsonSchema(issues.CreateIssueSchema),
      },
      {
        name: "create_pull_request",
        description: "Create a new pull request in a GitHub repository",
        inputSchema: zodToJsonSchema(pulls.CreatePullRequestSchema),
      },
      {
        name: "fork_repository",
        description: "Fork a GitHub repository to your account or specified organization",
        inputSchema: zodToJsonSchema(repository.ForkRepositorySchema),
      },
      {
        name: "create_branch",
        description: "Create a new branch in a GitHub repository",
        inputSchema: zodToJsonSchema(branches.CreateBranchSchema),
      },
      /*{
        name: "list_commits",
        description: "Get list of commits of a branch in a GitHub repository",
        inputSchema: zodToJsonSchema(commits.ListCommitsSchema)
      },*/
      {
        name: "list_issues",
        description: "List issues in a GitHub repository with filtering options",
        inputSchema: zodToJsonSchema(issues.ListIssuesOptionsSchema)
      },
      {
        name: "update_issue",
        description: "Update an existing issue in a GitHub repository",
        inputSchema: zodToJsonSchema(issues.UpdateIssueOptionsSchema)
      },
      /*{
        name: "add_issue_comment",
        description: "Add a comment to an existing issue",
        inputSchema: zodToJsonSchema(issues.IssueCommentSchema)
      },
      {
        name: "search_code",
        description: "Search for code across GitHub repositories",
        inputSchema: zodToJsonSchema(search.SearchCodeSchema),
      },*/
      {
        name: "search_issues",
        description: "Search for issues and pull requests across GitHub repositories",
        inputSchema: zodToJsonSchema(search.SearchIssuesSchema),
      },
      /*{
        name: "search_users",
        description: "Search for users on GitHub",
        inputSchema: zodToJsonSchema(search.SearchUsersSchema),
      },
      {
        name: "get_issue",
        description: "Get details of a specific issue in a GitHub repository.",
        inputSchema: zodToJsonSchema(issues.GetIssueSchema)
      },
      {
        name: "get_pull_request",
        description: "Get details of a specific pull request",
        inputSchema: zodToJsonSchema(pulls.GetPullRequestSchema)
      },
      {
        name: "list_pull_requests",
        description: "List and filter repository pull requests",
        inputSchema: zodToJsonSchema(pulls.ListPullRequestsSchema)
      },
      {
        name: "create_pull_request_review",
        description: "Create a review on a pull request",
        inputSchema: zodToJsonSchema(pulls.CreatePullRequestReviewSchema)
      },*/
      {
        name: "merge_pull_request",
        description: "Merge a pull request",
        inputSchema: zodToJsonSchema(pulls.MergePullRequestSchema)
      },
      /*{
        name: "get_pull_request_files",
        description: "Get the list of files changed in a pull request",
        inputSchema: zodToJsonSchema(pulls.GetPullRequestFilesSchema)
      },
      {
        name: "get_pull_request_status",
        description: "Get the combined status of all status checks for a pull request",
        inputSchema: zodToJsonSchema(pulls.GetPullRequestStatusSchema)
      },
      {
        name: "update_pull_request_branch",
        description: "Update a pull request branch with the latest changes from the base branch",
        inputSchema: zodToJsonSchema(pulls.UpdatePullRequestBranchSchema)
      },
      {
        name: "get_pull_request_comments",
        description: "Get the review comments on a pull request",
        inputSchema: zodToJsonSchema(pulls.GetPullRequestCommentsSchema)
      },
      {
        name: "get_pull_request_reviews",
        description: "Get the reviews on a pull request",
        inputSchema: zodToJsonSchema(pulls.GetPullRequestReviewsSchema)
      }*/
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "fork_repository": {
        const args = repository.ForkRepositorySchema.parse(request.params.arguments);
        const fork = await repository.forkRepository(args.owner, args.repo, args.organization);
        return {
          content: [{ type: "text", text: JSON.stringify(fork, null, 2) }],
        };
      }

      case "create_branch": {
        const args = branches.CreateBranchSchema.parse(request.params.arguments);
        const branch = await branches.createBranchFromRef(
          args.owner,
          args.repo,
          args.branch,
          args.from_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
        };
      /*}

      case "search_repositories": {
        const args = repository.SearchRepositoriesSchema.parse(request.params.arguments);
        const results = await repository.searchRepositories(
          args.query,
          args.page,
          args.perPage
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };*/
      }

      case "create_repository": {
        const args = repository.CreateRepositoryOptionsSchema.parse(request.params.arguments);
        const result = await repository.createRepository(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      /*}

      case "get_file_contents": {
        const args = files.GetFileContentsSchema.parse(request.params.arguments);
        const contents = await files.getFileContents(
          args.owner,
          args.repo,
          args.path,
          args.branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
        };
      }

      case "create_or_update_file": {
        const args = files.CreateOrUpdateFileSchema.parse(request.params.arguments);
        const result = await files.createOrUpdateFile(
          args.owner,
          args.repo,
          args.path,
          args.content,
          args.message,
          args.branch,
          args.sha
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "push_files": {
        const args = files.PushFilesSchema.parse(request.params.arguments);
        const result = await files.pushFiles(
          args.owner,
          args.repo,
          args.branch,
          args.files,
          args.message
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };*/
      }
      case "create_issue": {
        const args = issues.CreateIssueSchema.parse(request.params.arguments);
        const { owner, repo, ...options } = args;
      
        try {
          // 1. EXECUTION: Call the actual GitHub API function
          const issue = await issues.createIssue(owner, repo, options);
      
          // 2. SUCCESS RETURN - Proper MCP format
          return {
            content: [{
              type: "text",
              text: JSON.stringify(issue, null, 2)
            }],
          };
      
        } catch (error) {
          // 3. ERROR HANDLING - Return a structured error in MCP format
          let statusCode = 500;
          let errorMessage = "An unexpected error occurred during the GitHub operation.";
      
          if (isGitHubError(error)) { // Using your existing type guard
            errorMessage = error.message;
            if (error instanceof GitHubResourceNotFoundError) statusCode = 404;
            else if (error instanceof GitHubPermissionError) statusCode = 403;
            else if (error instanceof GitHubValidationError) statusCode = 400; // Or 422
            else if (error instanceof GitHubConflictError) statusCode = 409;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
      
          console.error(`[ERROR] GitHub Tool Execution Failed (${statusCode}):`, errorMessage);
      
          // CRITICAL: Return the error in the proper MCP content format
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: "API_EXECUTION_FAILURE",
                message: `GitHub API error: ${statusCode} - ${errorMessage}`,
                status_code: statusCode
              }, null, 2)
            }],
          };
        }
      }
      
      // Replace the existing 'create_pull_request' case with this
case "create_pull_request": {
  const args = pulls.CreatePullRequestSchema.parse(request.params.arguments);
  
  try {
      // 1. EXECUTION
      const pullRequest = await pulls.createPullRequest(args);

      // 2. SUCCESS RETURN
      return {
          content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }],
      };

  } catch (error) {
      // 3. ERROR HANDLING
      let statusCode = 500;
      let errorMessage = "An unexpected error occurred during the GitHub operation.";

      if (isGitHubError(error)) {
          errorMessage = error.message;
          if (error instanceof GitHubResourceNotFoundError) statusCode = 404;
          else if (error instanceof GitHubPermissionError) statusCode = 403;
          else if (error instanceof GitHubValidationError) statusCode = 422;
          else if (error instanceof GitHubConflictError) statusCode = 409;
      } else if (error instanceof Error) {
          errorMessage = error.message;
      }

      console.error(`[ERROR] GitHub Tool Execution Failed (${statusCode}):`, errorMessage);

      return {
          content: [{
              type: "text",
              text: JSON.stringify({
                  error: "API_EXECUTION_FAILURE",
                  message: `GitHub API error: ${statusCode} - ${errorMessage}`,
                  status_code: statusCode
              }, null, 2)
          }],
      };
  }
      /*}

      case "search_code": {
        const args = search.SearchCodeSchema.parse(request.params.arguments);
        const results = await search.searchCode(args);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };*/
      }

      case "search_issues": {
        const args = search.SearchIssuesSchema.parse(request.params.arguments);
        const results = await search.searchIssues(args);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      /*}

      case "search_users": {
        const args = search.SearchUsersSchema.parse(request.params.arguments);
        const results = await search.searchUsers(args);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };*/
      }

      case "list_issues": {
        const args = issues.ListIssuesOptionsSchema.parse(request.params.arguments);
        const { owner, repo, ...options } = args;
        const result = await issues.listIssues(owner, repo, options);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_issue": {
        const args = issues.UpdateIssueOptionsSchema.parse(request.params.arguments);
        const { owner, repo, issue_number, ...options } = args;
        const result = await issues.updateIssue(owner, repo, issue_number, options);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      /*}

      case "add_issue_comment": {
        const args = issues.IssueCommentSchema.parse(request.params.arguments);
        const { owner, repo, issue_number, body } = args;
        const result = await issues.addIssueComment(owner, repo, issue_number, body);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_commits": {
        const args = commits.ListCommitsSchema.parse(request.params.arguments);
        const results = await commits.listCommits(
          args.owner,
          args.repo,
          args.page,
          args.perPage,
          args.sha
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "get_issue": {
        const args = issues.GetIssueSchema.parse(request.params.arguments);
        const issue = await issues.getIssue(args.owner, args.repo, args.issue_number);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "get_pull_request": {
        const args = pulls.GetPullRequestSchema.parse(request.params.arguments);
        const pullRequest = await pulls.getPullRequest(args.owner, args.repo, args.pull_number);
        return {
          content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }],
        };
      }

      case "list_pull_requests": {
        const args = pulls.ListPullRequestsSchema.parse(request.params.arguments);
        const { owner, repo, ...options } = args;
        const pullRequests = await pulls.listPullRequests(owner, repo, options);
        return {
          content: [{ type: "text", text: JSON.stringify(pullRequests, null, 2) }],
        };
      }

      case "create_pull_request_review": {
        const args = pulls.CreatePullRequestReviewSchema.parse(request.params.arguments);
        const { owner, repo, pull_number, ...options } = args;
        const review = await pulls.createPullRequestReview(owner, repo, pull_number, options);
        return {
          content: [{ type: "text", text: JSON.stringify(review, null, 2) }],
        };*/
      }

      case "merge_pull_request": {
        const args = pulls.MergePullRequestSchema.parse(request.params.arguments);
        const { owner, repo, pull_number, ...options } = args;
        const result = await pulls.mergePullRequest(owner, repo, pull_number, options);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      /*}

      case "get_pull_request_files": {
        const args = pulls.GetPullRequestFilesSchema.parse(request.params.arguments);
        const files = await pulls.getPullRequestFiles(args.owner, args.repo, args.pull_number);
        return {
          content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
        };
      }

      case "get_pull_request_status": {
        const args = pulls.GetPullRequestStatusSchema.parse(request.params.arguments);
        const status = await pulls.getPullRequestStatus(args.owner, args.repo, args.pull_number);
        return {
          content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
        };
      }

      case "update_pull_request_branch": {
        const args = pulls.UpdatePullRequestBranchSchema.parse(request.params.arguments);
        const { owner, repo, pull_number, expected_head_sha } = args;
        await pulls.updatePullRequestBranch(owner, repo, pull_number, expected_head_sha);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case "get_pull_request_comments": {
        const args = pulls.GetPullRequestCommentsSchema.parse(request.params.arguments);
        const comments = await pulls.getPullRequestComments(args.owner, args.repo, args.pull_number);
        return {
          content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
        };
      }

      case "get_pull_request_reviews": {
        const args = pulls.GetPullRequestReviewsSchema.parse(request.params.arguments);
        const reviews = await pulls.getPullRequestReviews(args.owner, args.repo, args.pull_number);
        return {
          content: [{ type: "text", text: JSON.stringify(reviews, null, 2) }],
        };*/
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${JSON.stringify(error.errors)}`);
    }
    if (isGitHubError(error)) {
      throw new Error(formatGitHubError(error));
    }
    throw error;
  }
});

async function runServer() {
  const port = parseInt(process.env.PORT || '9001', 10);
  const host = process.env.HOST || 'localhost';
  const sseEndpoint = process.env.SSE_ENDPOINT || '/sse';
  const messageEndpoint = process.env.MESSAGE_ENDPOINT || '/message';
  const httpServer = createServer();
  
  // Store active transports by session ID
  const transports = new Map<string, SSEServerTransport>();
  
  httpServer.on('request', async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.method === 'GET' && url.pathname === sseEndpoint) {
      // Create new SSE transport for this connection
      const transport = new SSEServerTransport(messageEndpoint, res);
      transports.set(transport.sessionId, transport);
      
      // Connect the server to this transport
      await server.connect(transport);
      
      // Clean up when connection closes
      transport.onclose = () => {
        transports.delete(transport.sessionId);
      };
      
    } else if (req.method === 'POST' && url.pathname === sseEndpoint) {
      // Handle POST requests to SSE endpoint (StreamableHTTP MCP protocol)
      // Read the request body
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const message = JSON.parse(body);
          console.error(`[DEBUG] Received MCP message:`, JSON.stringify(message, null, 2));
          
          // Extract GitHub token from Authorization header
          let githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            githubToken = authHeader.substring(7); // Remove 'Bearer ' prefix
            console.error(`[DEBUG] Using GitHub token from Authorization header`);
          } else if (githubToken) {
            console.error(`[DEBUG] Using GitHub token from environment variable`);
          } else {
            console.error(`[DEBUG] No GitHub token found in Authorization header or environment`);
          }
          
          // Set the token in the environment for this request
          if (githubToken) {
            process.env.GITHUB_PERSONAL_ACCESS_TOKEN = githubToken;
          }
          
          // Create a simple response handler
          const responseHandler = {
            send: (response: any) => {
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
              });
              res.end(JSON.stringify(response));
            },
            error: (error: any, id?: any) => {
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              const errorResponse = {
                jsonrpc: "2.0",
                id: id || null,
                error: {
                  code: -32603, // Internal error
                  message: error instanceof Error ? error.message : String(error),
                  data: error instanceof Error && error.stack ? error.stack : undefined
                }
              };
              res.end(JSON.stringify(errorResponse));
            }
          };
          
          // Handle the MCP message directly
          if (message.method === 'initialize') {
            responseHandler.send({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  tools: {}
                },
                serverInfo: {
                  name: "github-mcp-server",
                  version: "0.6.2"
                }
              }
            });
          } else if (message.method === 'tools/list') {
            // Return the complete list of tools using the original server's tool definitions
            const toolsList = {
              tools: [
                /*{
                  name: "create_or_update_file",
                  description: "Create or update a single file in a GitHub repository",
                  inputSchema: zodToJsonSchema(files.CreateOrUpdateFileSchema),
                },
                {
                  name: "search_repositories",
                  description: "Search for GitHub repositories",
                  inputSchema: zodToJsonSchema(repository.SearchRepositoriesSchema),
                },*/
                {
                  name: "create_repository",
                  description: "Create a new GitHub repository in your account",
                  inputSchema: zodToJsonSchema(repository.CreateRepositoryOptionsSchema),
                },
                /*{
                  name: "get_file_contents",
                  description: "Get the contents of a file or directory from a GitHub repository",
                  inputSchema: zodToJsonSchema(files.GetFileContentsSchema),
                },
                {
                  name: "push_files",
                  description: "Push multiple files to a GitHub repository in a single commit",
                  inputSchema: zodToJsonSchema(files.PushFilesSchema),
                },*/
                {
                  name: "create_issue",
                  description: "Create a new issue in a GitHub repository",
                  inputSchema: zodToJsonSchema(issues.CreateIssueSchema),
                },
                {
                  name: "create_pull_request",
                  description: "Create a new pull request in a GitHub repository",
                  inputSchema: zodToJsonSchema(pulls.CreatePullRequestSchema),
                },
                {
                  name: "fork_repository",
                  description: "Fork a GitHub repository to your account or specified organization",
                  inputSchema: zodToJsonSchema(repository.ForkRepositorySchema),
                },
                {
                  name: "create_branch",
                  description: "Create a new branch in a GitHub repository",
                  inputSchema: zodToJsonSchema(branches.CreateBranchSchema),
                },
                /*{
                  name: "list_commits",
                  description: "Get list of commits of a branch in a GitHub repository",
                  inputSchema: zodToJsonSchema(commits.ListCommitsSchema)
                },*/
                {
                  name: "list_issues",
                  description: "List issues in a GitHub repository with filtering options",
                  inputSchema: zodToJsonSchema(issues.ListIssuesOptionsSchema)
                },
                {
                  name: "update_issue",
                  description: "Update an existing issue in a GitHub repository",
                  inputSchema: zodToJsonSchema(issues.UpdateIssueOptionsSchema)
                },
                /*{
                  name: "add_issue_comment",
                  description: "Add a comment to an existing issue",
                  inputSchema: zodToJsonSchema(issues.IssueCommentSchema)
                },
                {
                  name: "search_code",
                  description: "Search for code across GitHub repositories",
                  inputSchema: zodToJsonSchema(search.SearchCodeSchema),
                },*/
                {
                  name: "search_issues",
                  description: "Search for issues and pull requests across GitHub repositories",
                  inputSchema: zodToJsonSchema(search.SearchIssuesSchema),
                },
                /*{
                  name: "search_users",
                  description: "Search for users on GitHub",
                  inputSchema: zodToJsonSchema(search.SearchUsersSchema),
                },
                {
                  name: "get_issue",
                  description: "Get details of a specific issue in a GitHub repository.",
                  inputSchema: zodToJsonSchema(issues.GetIssueSchema)
                },
                {
                  name: "get_pull_request",
                  description: "Get details of a specific pull request",
                  inputSchema: zodToJsonSchema(pulls.GetPullRequestSchema)
                },
                {
                  name: "list_pull_requests",
                  description: "List and filter repository pull requests",
                  inputSchema: zodToJsonSchema(pulls.ListPullRequestsSchema)
                },
                {
                  name: "create_pull_request_review",
                  description: "Create a review on a pull request",
                  inputSchema: zodToJsonSchema(pulls.CreatePullRequestReviewSchema)
                },*/
                {
                  name: "merge_pull_request",
                  description: "Merge a pull request",
                  inputSchema: zodToJsonSchema(pulls.MergePullRequestSchema)
                },
                /*{
                  name: "get_pull_request_files",
                  description: "Get the list of files changed in a pull request",
                  inputSchema: zodToJsonSchema(pulls.GetPullRequestFilesSchema)
                },
                {
                  name: "get_pull_request_status",
                  description: "Get the combined status of all status checks for a pull request",
                  inputSchema: zodToJsonSchema(pulls.GetPullRequestStatusSchema)
                },
                {
                  name: "update_pull_request_branch",
                  description: "Update a pull request branch with the latest changes from the base branch",
                  inputSchema: zodToJsonSchema(pulls.UpdatePullRequestBranchSchema)
                },
                {
                  name: "get_pull_request_comments",
                  description: "Get the review comments on a pull request",
                  inputSchema: zodToJsonSchema(pulls.GetPullRequestCommentsSchema)
                },
                {
                  name: "get_pull_request_reviews",
                  description: "Get the reviews on a pull request",
                  inputSchema: zodToJsonSchema(pulls.GetPullRequestReviewsSchema)
                }*/
              ]
            };
            
            responseHandler.send({
              jsonrpc: "2.0",
              id: message.id,
              result: toolsList
            });
          } else if (message.method === 'tools/call') {
            // Create a request object that matches CallToolRequestSchema
            const toolRequest = {
              params: {
                name: message.params.name,
                arguments: message.params.arguments
              }
            };
            
            // Manually handle the tool call using the existing switch logic
            try {
              let result;
              const toolName = toolRequest.params.name;
              const args = toolRequest.params.arguments;
              
              console.error(`[DEBUG] Executing tool: ${toolName}`);
              console.error(`[DEBUG] Tool arguments:`, JSON.stringify(args, null, 2));
              
              // Use the same logic as in the existing CallToolRequestSchema handler
              // This is a simplified version - for a complete implementation, 
              // we'd need to add all tool cases from the original handler
              switch (toolName) {
                case "fork_repository": {
                  const parsedArgs = repository.ForkRepositorySchema.parse(args);
                  result = await repository.forkRepository(parsedArgs.owner, parsedArgs.repo, parsedArgs.organization);
                  break;
                }
                case "create_branch": {
                  const parsedArgs = branches.CreateBranchSchema.parse(args);
                  result = await branches.createBranchFromRef(
                    parsedArgs.owner,
                    parsedArgs.repo,
                    parsedArgs.branch,
                    parsedArgs.from_branch
                  );
                  break;
                }
                /*case "search_repositories": {
                  const parsedArgs = repository.SearchRepositoriesSchema.parse(args);
                  result = await repository.searchRepositories(
                    parsedArgs.query,
                    parsedArgs.page,
                    parsedArgs.perPage
                  );
                  break;
                  }*/
                case "create_repository": {
                  const parsedArgs = repository.CreateRepositoryOptionsSchema.parse(args);
                  result = await repository.createRepository(parsedArgs);
                  break;
                }
                /*case "get_file_contents": {
                  const parsedArgs = files.GetFileContentsSchema.parse(args);
                  result = await files.getFileContents(
                    parsedArgs.owner,
                    parsedArgs.repo,
                    parsedArgs.path,
                    parsedArgs.branch
                  );
                  break;
                }
                case "create_or_update_file": {
                  const parsedArgs = files.CreateOrUpdateFileSchema.parse(args);
                  result = await files.createOrUpdateFile(
                    parsedArgs.owner,
                    parsedArgs.repo,
                    parsedArgs.path,
                    parsedArgs.content,
                    parsedArgs.message,
                    parsedArgs.branch,
                    parsedArgs.sha
                  );
                  break;
                }
                case "push_files": {
                  const parsedArgs = files.PushFilesSchema.parse(args);
                  result = await files.pushFiles(
                    parsedArgs.owner,
                    parsedArgs.repo,
                    parsedArgs.branch,
                    parsedArgs.files,
                    parsedArgs.message
                  );
                  break;
                }*/
                case "create_issue": {
                  const parsedArgs = issues.CreateIssueSchema.parse(args);
                  const { owner, repo, ...options } = parsedArgs;
                  result = await issues.createIssue(owner, repo, options);
                  break;
                }
                case "create_pull_request": {
                  const parsedArgs = pulls.CreatePullRequestSchema.parse(args);
                  result = await pulls.createPullRequest(parsedArgs);
                  break;
                }
                /*case "search_code": {
                  const parsedArgs = search.SearchCodeSchema.parse(args);
                  result = await search.searchCode(parsedArgs);
                  break;
                }*/
                case "search_issues": {
                  const parsedArgs = search.SearchIssuesSchema.parse(args);
                  result = await search.searchIssues(parsedArgs);
                  break;
                }
                /*case "search_users": {
                  const parsedArgs = search.SearchUsersSchema.parse(args);
                  result = await search.searchUsers(parsedArgs);
                  break;
                }*/
                case "list_issues": {
                  const parsedArgs = issues.ListIssuesOptionsSchema.parse(args);
                  const { owner, repo, ...options } = parsedArgs;
                  result = await issues.listIssues(owner, repo, options);
                  break;
                }
                case "update_issue": {
                  const parsedArgs = issues.UpdateIssueOptionsSchema.parse(args);
                  const { owner, repo, issue_number, ...options } = parsedArgs;
                  result = await issues.updateIssue(owner, repo, issue_number, options);
                  break;
                }
                /*case "add_issue_comment": {
                  const parsedArgs = issues.IssueCommentSchema.parse(args);
                  const { owner, repo, issue_number, body } = parsedArgs;
                  result = await issues.addIssueComment(owner, repo, issue_number, body);
                  break;
                }
                case "list_commits": {
                  const parsedArgs = commits.ListCommitsSchema.parse(args);
                  result = await commits.listCommits(
                    parsedArgs.owner,
                    parsedArgs.repo,
                    parsedArgs.page,
                    parsedArgs.perPage,
                    parsedArgs.sha
                  );
                  break;
                }
                case "get_issue": {
                  const parsedArgs = issues.GetIssueSchema.parse(args);
                  result = await issues.getIssue(parsedArgs.owner, parsedArgs.repo, parsedArgs.issue_number);
                  break;
                }
                case "get_pull_request": {
                  const parsedArgs = pulls.GetPullRequestSchema.parse(args);
                  result = await pulls.getPullRequest(parsedArgs.owner, parsedArgs.repo, parsedArgs.pull_number);
                  break;
                }
                case "list_pull_requests": {
                  const parsedArgs = pulls.ListPullRequestsSchema.parse(args);
                  const { owner, repo, ...options } = parsedArgs;
                  result = await pulls.listPullRequests(owner, repo, options);
                  break;
                }
                case "create_pull_request_review": {
                  const parsedArgs = pulls.CreatePullRequestReviewSchema.parse(args);
                  const { owner, repo, pull_number, ...options } = parsedArgs;
                  result = await pulls.createPullRequestReview(owner, repo, pull_number, options);
                  break;
                }*/
                case "merge_pull_request": {
                  const parsedArgs = pulls.MergePullRequestSchema.parse(args);
                  const { owner, repo, pull_number, ...options } = parsedArgs;
                  result = await pulls.mergePullRequest(owner, repo, pull_number, options);
                  break;
                }
                /*case "get_pull_request_files": {
                  const parsedArgs = pulls.GetPullRequestFilesSchema.parse(args);
                  result = await pulls.getPullRequestFiles(parsedArgs.owner, parsedArgs.repo, parsedArgs.pull_number);
                  break;
                }
                case "get_pull_request_status": {
                  const parsedArgs = pulls.GetPullRequestStatusSchema.parse(args);
                  result = await pulls.getPullRequestStatus(parsedArgs.owner, parsedArgs.repo, parsedArgs.pull_number);
                  break;
                }
                case "update_pull_request_branch": {
                  const parsedArgs = pulls.UpdatePullRequestBranchSchema.parse(args);
                  const { owner, repo, pull_number, expected_head_sha } = parsedArgs;
                  await pulls.updatePullRequestBranch(owner, repo, pull_number, expected_head_sha);
                  result = { success: true };
                  break;
                }
                case "get_pull_request_comments": {
                  const parsedArgs = pulls.GetPullRequestCommentsSchema.parse(args);
                  result = await pulls.getPullRequestComments(parsedArgs.owner, parsedArgs.repo, parsedArgs.pull_number);
                  break;
                }
                case "get_pull_request_reviews": {
                  const parsedArgs = pulls.GetPullRequestReviewsSchema.parse(args);
                  result = await pulls.getPullRequestReviews(parsedArgs.owner, parsedArgs.repo, parsedArgs.pull_number);
                  break;
                }*/
                default:
                  throw new Error(`Unknown tool: ${toolName}`);
              }
              
              console.error(`[DEBUG] Tool '${toolName}' executed successfully`);
              console.error(`[DEBUG] Tool result:`, JSON.stringify(result, null, 2));
              
              responseHandler.send({
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                }
              });
            } catch (error) {
              console.error(`[ERROR] Error executing tool '${toolRequest.params.name}':`, error);
              
              // Ensure we always send a response
              if (error instanceof Error) {
                responseHandler.error(error, message.id);
              } else {
                responseHandler.error(new Error(`Tool execution failed: ${String(error)}`), message.id);
              }
            }
          } else if (message.method === 'initialized') {
            // Handle initialized notification - just acknowledge it
            if (message.id !== null && message.id !== undefined) {
              responseHandler.send({
                jsonrpc: "2.0",
                id: message.id,
                result: {}
              });
            } else {
              // It's a notification, no response needed per JSON-RPC 2.0 spec
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(); // Send empty response body for notifications
            }
          } else if (message.method === 'notifications/initialized') {
            // Another form of initialized notification - no response needed per JSON-RPC 2.0
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(); // Send empty response body for notifications
          } else {
            console.error(`[WARNING] Unsupported method: ${message.method}`);
            responseHandler.error(new Error(`Unsupported method: ${message.method}`), message.id);
          }
        } catch (error) {
          console.error(`[ERROR] Error processing MCP message:`, error);
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ 
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' }
          }));
        }
      });
      
    } else if (req.method === 'POST' && url.pathname === messageEndpoint) {
      // Handle incoming messages
      const sessionId = url.searchParams.get('sessionId');
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handlePostMessage(req, res);
      } else {
        res.writeHead(404);
        res.end('Session not found');
      }
    } else if (req.method === 'OPTIONS') {
      // Handle CORS preflight requests
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400' // Cache preflight for 24 hours
      });
      res.end();
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  httpServer.listen(port, host, () => {
    console.error(`GitHub MCP Server running on HTTP port ${port}`);
    console.error(`SSE endpoint: http://${host}:${port}${sseEndpoint}`);
    console.error(`Message endpoint: http://${host}:${port}${messageEndpoint}`);
  });
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});