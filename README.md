# arXiv MCP Server

An MCP (Model Context Protocol) server for searching and analyzing academic papers on arXiv.

Built as a case study demonstrating how an open academic API can be exposed as an AI-ready asset through the MCP protocol.

## Available Tools

| Tool | Description |
|---|---|
| `search_papers` | Search papers by keywords, topic, or author |
| `get_paper` | Get full details of a paper by arXiv ID |
| `search_by_category` | Browse papers by arXiv category (cs.AI, cs.LG, etc.) |

## Installation Options

### Option 1 — No install (hosted endpoint)

Add this URL to Claude Desktop Settings → Integrations, or to Claude.ai:

```
https://arxiv-mcp-server.madi.workers.dev/mcp
```

### Option 2 — Local via npx (requires Node.js)

Add to your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "npx",
      "args": ["arxiv-mcp-server"]
    }
  }
}
```

### Option 3 — Clone and run locally

```bash
git clone https://github.com/madi/arxiv-mcp-server
cd arxiv-mcp-server
npm install
npm run build
```

Then add to Claude Desktop config:

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "node",
      "args": ["/absolute/path/to/arxiv-mcp-server/dist/index.js"]
    }
  }
}
```

## Deploy to Cloudflare Workers

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Your server will be live at `https://arxiv-mcp-server.madi.workers.dev`.

## Example Usage in Claude Desktop

Once connected, you can ask Claude things like:

> "Search for recent papers on AI policy and regulation"

> "Find papers on geospatial machine learning from the last 6 months"

> "Get details of paper 2301.07041"

> "What are the latest papers in cs.AI about large language models?"

> "Search category cs.LG for papers on transformers"

## Project Structure

```
arxiv-mcp-server/
├── src/
│   ├── index.ts          # Local entry point (stdio transport)
│   ├── worker.ts         # Cloudflare Workers entry point (HTTP transport)
│   ├── server.ts         # MCP tool registration — the core of the server
│   └── utils/
│       └── arxiv.ts      # arXiv API client and XML parser
├── package.json
├── tsconfig.json
├── wrangler.toml         # Cloudflare Workers configuration
├── .env.example
└── README.md
```

## Why This Is an AI-Ready Asset

This server demonstrates the full asset chain of an AI-ready ecosystem:

```
Data (arXiv corpus)
  → API (arXiv REST API wrapped as MCP tools)
    → Model (any LLM can consume and analyze the papers)
      → Agent (Claude orchestrates search + analysis via MCP)
```

The key insight: arXiv data becomes truly **AI-ready** not just because it is open and structured,
but because it is **accessible to agents** through a standardized interface (MCP).

## License

MIT
