#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import { isDaemonRunning } from "@nicorodri/tempo-daemon";

const server = new McpServer({
  name: "Tempo-MCP-Server",
  version: packageJson.version,
  description: "Tempo MCP Server",
});

server.tool(
  "check-tracking-status",
  "Check whether the tempo tracker is running at the moment",
  () => {
    return {
      content: [
        {
          type: "text",
          text: isDaemonRunning() ? "Tempo is running" : "Tempo is not running",
        },
      ],
    };
  },
);

async function main() {
  console.log(`Starting Tempo MCP Server v${packageJson.version}...`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main()
  .then(() => {
    console.log("Server started!");
  })
  .catch((error) => {
    console.error("Error starting server:", error);
    process.exit(1);
  });
