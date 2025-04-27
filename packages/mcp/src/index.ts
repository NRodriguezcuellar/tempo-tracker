import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import { isDaemonRunning } from "@nicorodri/tempo-daemon";
import {
  displayWorklogs,
  startTrackingWithErrorHandling,
  statusTrackingWithErrorHandling,
  stopTrackingWithErrorHandling,
} from "packages/cli/src/commands";
import z from "zod";

const server = new McpServer({
  name: "Tempo-MCP-Server",
  version: packageJson.version,
  description: "Tempo MCP Server",
});

server.tool(
  "check-tempo-tracker-status",
  "Check whether the tempo tracker is running at the moment",
  async () => {
    const response = await statusTrackingWithErrorHandling();

    if (response.error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get status because of ${response.error}`,
          },
        ],
      };
    }

    if (response.isTrackingCurrentBranch) {
      return {
        content: [
          {
            type: "text",
            text: response.isTrackingCurrentBranch
              ? "Tempo is running"
              : "Tempo is not running",
          },
        ],
      };
    }

    if (
      response.currentActiveSessions &&
      response.currentActiveSessions.length > 0
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Tempo is running on ${response.currentActiveSessions.map(
              (session) => session.branch,
            )}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: "Tempo is not running",
        },
      ],
    };
  },
);

server.tool(
  "start-tempo-tracker",
  "Start the tempo tracker in this branch",
  {
    description: z.string().optional(),
    issueId: z.number().optional(),
  },
  async ({ description, issueId }) => {
    const response = await startTrackingWithErrorHandling({
      description,
      issueId,
    });
    return {
      content: [
        {
          type: "text",
          text: response.success
            ? "Tracking started"
            : `Failed to start tracking because of ${response.error}`,
        },
      ],
    };
  },
);

server.tool(
  "stop-tempo-tracker",
  "stop the tempo tracker in this branch",
  async () => {
    const response = await stopTrackingWithErrorHandling();

    return {
      content: [
        {
          type: "text",
          text: response.success
            ? "Tracking stopped succesfully"
            : `Failed to stop tracking because of ${response.error}`,
        },
      ],
    };
  },
);

server.tool(
  "get-tempo-work-logs",
  "Get all the worklogs stored, there are filters available and the default result limit is 20",
  {
    branch: z
      .string()
      .optional()
      .describe(
        "Filter for an exact match of the branch, not meant for fuzzy search.",
      ),
    issueId: z.number().optional(),
    date: z.string().date().optional().describe("Date in format YYYY-MM-DD"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Limit the number of results"),
  },
  async ({ branch, date, issueId, limit }) => {
    const response = await displayWorklogs({
      branch,
      date,
      issueId,
      limit,
    }).then((results) => {
      // filter out directories from the results, for privacy reasons
      return {
        ...results,
        activities: results?.activities?.map((result) => ({
          ...result,
          directory: null,
        })),
      };
    });

    if (response.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.activities),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to get work logs because of ${response.error}`,
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
