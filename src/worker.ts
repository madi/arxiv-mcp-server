// Cloudflare Workers entry point.
// This replaces index.ts for remote deployment:
// instead of stdio, messages arrive as HTTP requests.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { searchArxiv, getArxivPaper, ArxivPaper } from "./utils/arxiv.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, mcp-protocol-version",
};

// Cloudflare Workers exposes a global fetch handler
// that receives all incoming HTTP requests.
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Handle MCP protocol messages — POST/GET/DELETE to /mcp
    if (url.pathname === "/mcp") {
      // Create a fresh server and transport per request (stateless)
      const server = createServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      const response = await transport.handleRequest(request);

      // Add CORS headers to the response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Health check endpoint
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(JSON.stringify({
        name: "arxiv-mcp-server",
        version: "0.1.0",
        status: "ok",
        tools: ["search_papers", "get_paper", "search_by_category"],
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
};

// Create a fresh MCP server instance per request.
// Cloudflare Workers are stateless — we can't share a server across requests.
function createServer(): McpServer {
  const server = new McpServer({
    name: "arxiv-mcp-server",
    version: "0.1.0",
  });

  server.registerTool(
    "search_papers",
    {
      title: "Search arXiv Papers",
      description: `Search for academic papers on arXiv.
        Use this tool when the user wants to find papers on a topic.
        Returns titles, authors, abstracts and links.`,
      inputSchema: z.object({
        query: z.string().describe("Search query — topic keywords, author names, or arXiv categories"),
        maxResults: z.number().min(1).max(50).default(10).describe("Number of papers to return (default: 10, max: 50)"),
        sortBy: z.enum(["relevance", "lastUpdatedDate", "submittedDate"]).default("relevance").describe("Sort order"),
      }),
    },
    async ({ query, maxResults, sortBy }) => {
      const papers = await searchArxiv(query, maxResults, sortBy);
      if (papers.length === 0) {
        return { content: [{ type: "text", text: `No papers found for: "${query}"` }] };
      }
      const formatted = papers.map((p, i) => formatPaper(p, i + 1)).join("\n\n---\n\n");
      return { content: [{ type: "text", text: `Found ${papers.length} papers for "${query}":\n\n${formatted}` }] };
    }
  );

  server.registerTool(
    "get_paper",
    {
      title: "Get Paper Details",
      description: `Get full details of a specific arXiv paper by its ID (e.g. 2301.07041).`,
      inputSchema: z.object({
        arxivId: z.string().describe("The arXiv paper ID, e.g. '2301.07041'"),
      }),
    },
    async ({ arxivId }) => {
      const paper = await getArxivPaper(arxivId);
      return { content: [{ type: "text", text: formatPaperFull(paper) }] };
    }
  );

  server.registerTool(
    "search_by_category",
    {
      title: "Search by arXiv Category",
      description: `Search papers in a specific arXiv category (cs.AI, cs.LG, cs.CL, stat.ML, etc.)`,
      inputSchema: z.object({
        category: z.string().describe("arXiv category code, e.g. 'cs.AI'"),
        keywords: z.string().optional().describe("Optional keywords to filter within the category"),
        maxResults: z.number().min(1).max(50).default(10),
      }),
    },
    async ({ category, keywords, maxResults }) => {
      const query = keywords ? `cat:${category} AND (${keywords})` : `cat:${category}`;
      const papers = await searchArxiv(query, maxResults, "lastUpdatedDate");
      if (papers.length === 0) {
        return { content: [{ type: "text", text: `No papers found in ${category}${keywords ? ` for "${keywords}"` : ""}` }] };
      }
      const formatted = papers.map((p, i) => formatPaper(p, i + 1)).join("\n\n---\n\n");
      return { content: [{ type: "text", text: `Latest papers in **${category}**${keywords ? ` matching "${keywords}"` : ""}:\n\n${formatted}` }] };
    }
  );

  return server;
}

function formatPaper(paper: ArxivPaper, index: number): string {
  return `**${index}. ${paper.title}**
${paper.authors.slice(0, 3).join(", ")}${paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : ""}
${paper.published} | ${paper.categories.slice(0, 3).join(", ")}
${paper.url} | PDF: ${paper.pdfUrl}

${paper.abstract.slice(0, 300)}${paper.abstract.length > 300 ? "..." : ""}`;
}

function formatPaperFull(paper: ArxivPaper): string {
  return `# ${paper.title}

**Authors:** ${paper.authors.join(", ")}
**Published:** ${paper.published}
**Updated:** ${paper.updated}
**Categories:** ${paper.categories.join(", ")}
**arXiv ID:** ${paper.id}

**Links:**
- Abstract: ${paper.url}
- PDF: ${paper.pdfUrl}

## Abstract

${paper.abstract}`;
}
