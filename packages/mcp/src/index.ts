import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import { isDaemonRunning } from "@nicorodri/tempo-daemon";
import z from "zod";

const server = new McpServer({
  name: "Tempo-MCP-Server",
  version: packageJson.version,
});

server.tool("check tracking status", () => {
  return {
    content: [
      {
        type: "text",
        text: isDaemonRunning() ? "Daemon is running" : "Daemon is not running",
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
