// Cloudflare Workers entry point.
// This replaces index.ts for remote deployment:
// instead of stdio, messages arrive as HTTP requests.

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { server } from "./server.js";

// Cloudflare Workers exposes a global fetch handler
// that receives all incoming HTTP requests.
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle MCP protocol messages — POST/GET/DELETE to /mcp
    if (url.pathname === "/mcp") {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode for Cloudflare Workers
      });
      await server.connect(transport);
      return transport.handleRequest(request);
    }

    // Health check endpoint — useful to verify the server is running
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(JSON.stringify({
        name: "arxiv-mcp-server",
        version: "0.1.0",
        status: "ok",
        tools: ["search_papers", "get_paper", "search_by_category"],
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
