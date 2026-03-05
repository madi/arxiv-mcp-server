import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchArxiv, getArxivPaper, ArxivPaper } from "./utils/arxiv.js";

// Create the MCP server instance
// This is the equivalent of creating a Flask app in Python
export const server = new McpServer({
  name: "arxiv-mcp-server",
  version: "0.1.0",
});

// ─────────────────────────────────────────────
// TOOL 1: search_papers
// ─────────────────────────────────────────────
// Main search tool — finds papers by keyword or topic.
// Claude calls this automatically when you write "find papers on X".

server.registerTool(
  "search_papers",
  {
    title: "Search arXiv Papers",
    description: `Search for academic papers on arXiv.
      Use this tool when the user wants to find papers on a topic.
      Returns titles, authors, abstracts and links.
      Examples of good queries:
      - "AI policy governance regulation"
      - "geospatial deep learning remote sensing"
      - "large language models evaluation"`,

    // inputSchema defines what Claude must pass to the tool.
    // Zod is the validation library — equivalent to Pydantic in Python.
    inputSchema: z.object({
      query: z.string().describe(
        "Search query. Can include topic keywords, author names, or arXiv categories like cs.AI, cs.LG"
      ),
      maxResults: z.number().min(1).max(50).default(10).describe(
        "Number of papers to return (default: 10, max: 50)"
      ),
      sortBy: z.enum(["relevance", "lastUpdatedDate", "submittedDate"])
        .default("relevance")
        .describe("Sort order: relevance, lastUpdatedDate, or submittedDate"),
    }),
  },

  // Handler: the function executed when Claude calls this tool
  async ({ query, maxResults, sortBy }) => {
    try {
      const papers = await searchArxiv(query, maxResults, sortBy);

      if (papers.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No papers found for query: "${query}"`,
          }],
        };
      }

      // Format results as readable Markdown
      const formatted = papers
        .map((p, i) => formatPaperSummary(p, i + 1))
        .join("\n\n---\n\n");

      return {
        content: [{
          type: "text",
          text: `Found ${papers.length} papers for "${query}":\n\n${formatted}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching arXiv: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────
// TOOL 2: get_paper
// ─────────────────────────────────────────────
// Fetches the full details of a specific paper by arXiv ID.

server.registerTool(
  "get_paper",
  {
    title: "Get Paper Details",
    description: `Get full details of a specific arXiv paper by its ID.
      Use this when the user wants to know more about a specific paper.
      The arXiv ID looks like: 2301.07041 or cs/0601099`,

    inputSchema: z.object({
      arxivId: z.string().describe(
        "The arXiv paper ID, e.g. '2301.07041' or 'cs.AI/0601099'"
      ),
    }),
  },

  async ({ arxivId }) => {
    try {
      const paper = await getArxivPaper(arxivId);
      return {
        content: [{
          type: "text",
          text: formatPaperFull(paper),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error fetching paper ${arxivId}: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────
// TOOL 3: search_by_category
// ─────────────────────────────────────────────
// Searches papers within a specific arXiv category.
// Useful for monitoring a research field over time.

server.registerTool(
  "search_by_category",
  {
    title: "Search Papers by arXiv Category",
    description: `Search papers in a specific arXiv category.
      Useful for monitoring a research field.
      Common categories:
      - cs.AI  (Artificial Intelligence)
      - cs.LG  (Machine Learning)
      - cs.CL  (Computation and Language / NLP)
      - stat.ML (Statistics - Machine Learning)
      - eess.IV (Image and Video Processing)
      - physics.geo-ph (Geophysics)`,

    inputSchema: z.object({
      category: z.string().describe(
        "arXiv category code, e.g. 'cs.AI', 'cs.LG', 'physics.geo-ph'"
      ),
      keywords: z.string().optional().describe(
        "Optional additional keywords to filter within the category"
      ),
      maxResults: z.number().min(1).max(50).default(10),
    }),
  },

  async ({ category, keywords, maxResults }) => {
    try {
      // arXiv category queries use the cat: prefix
      const query = keywords
        ? `cat:${category} AND (${keywords})`
        : `cat:${category}`;

      const papers = await searchArxiv(query, maxResults, "lastUpdatedDate");

      if (papers.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No recent papers found in category ${category}${keywords ? ` with keywords "${keywords}"` : ""}`,
          }],
        };
      }

      const formatted = papers
        .map((p, i) => formatPaperSummary(p, i + 1))
        .join("\n\n---\n\n");

      return {
        content: [{
          type: "text",
          text: `Latest papers in **${category}**${keywords ? ` matching "${keywords}"` : ""}:\n\n${formatted}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────

function formatPaperSummary(paper: ArxivPaper, index: number): string {
  return `**${index}. ${paper.title}**
👤 ${paper.authors.slice(0, 3).join(", ")}${paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : ""}
📅 ${paper.published} | 🏷️ ${paper.categories.slice(0, 3).join(", ")}
🔗 ${paper.url} | 📄 PDF: ${paper.pdfUrl}

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
