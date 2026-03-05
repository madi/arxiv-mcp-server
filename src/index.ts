#!/usr/bin/env node
// The shebang above allows this file to be executed directly as a CLI command,
// which is required for npx distribution.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

async function main() {
  // stdio transport = communication via standard input/output.
  // This is how Claude Desktop "talks" to the server:
  // it spawns the process and exchanges JSON messages over stdin/stdout.
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // IMPORTANT: use console.error, not console.log.
  // stdout is reserved for the MCP protocol —
  // any console.log would corrupt the message stream.
  console.error("arXiv MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
