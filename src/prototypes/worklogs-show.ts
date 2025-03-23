/*
Currently the only things we can do with worklogs is syncing them. If we don't have a configuration set we can't do anything with the worklogs.

I want the user to be able to see the worklogs they have tracked in the extension, so they can see what they have tracked and when they have tracked it.
it should work with the activity command using 'activity list' to list all the worklogs. It should be displayed in a nice way with the date, duration, description, issue key and branch name.
Maybe in a table format.
*/

import { Command } from "commander";
import chalk from "chalk";
import { getActivityLog, ConfigType } from "../config";

interface WorklogDisplayOptions {
  limit?: number;
  date?: string;
  branch?: string;
  issueId?: number;
  all?: boolean;
  format?: "table" | "json";
}

/**
 * Format duration in a human-readable format
 */
function formatDuration(
  startTime: string,
  endTime: string | undefined
): string {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const durationMs = end.getTime() - start.getTime();

  // Format as hours and minutes
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format date in a readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

/**
 * Display worklogs in a table format
 */
async function displayWorklogs(options: WorklogDisplayOptions = {}) {
  const activityLog = await getActivityLog();

  // Apply filters
  let filteredLogs = [...activityLog];

  if (options.date) {
    filteredLogs = filteredLogs.filter((log) =>
      log.startTime.startsWith(options.date as string)
    );
  }

  if (options.branch) {
    filteredLogs = filteredLogs.filter((log) =>
      log.branch.includes(options.branch as string)
    );
  }

  if (options.issueId) {
    filteredLogs = filteredLogs.filter(
      (log) => log.issueId === options.issueId
    );
  }

  // Sort by start time (newest first)
  filteredLogs.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  // Apply limit if not showing all
  if (!options.all && options.limit) {
    filteredLogs = filteredLogs.slice(0, options.limit);
  }

  if (filteredLogs.length === 0) {
    console.log(chalk.yellow("No worklogs found matching the criteria."));
    return;
  }

  // Output as JSON if requested
  if (options.format === "json") {
    console.log(JSON.stringify(filteredLogs, null, 2));
    return;
  }

  // Display header
  console.log(chalk.bold("\nWorklogs:"));

  // Calculate column widths
  const dateWidth = 25;
  const durationWidth = 10;
  const branchWidth = 30;
  const issueWidth = 10;
  const descWidth = 40;
  const syncedWidth = 8;

  // Print header row
  console.log(
    chalk.blue("Date".padEnd(dateWidth)) +
      chalk.blue("Duration".padEnd(durationWidth)) +
      chalk.blue("Branch".padEnd(branchWidth)) +
      chalk.blue("Issue ID".padEnd(issueWidth)) +
      chalk.blue("Description".padEnd(descWidth)) +
      chalk.blue("Synced".padEnd(syncedWidth))
  );

  // Print separator
  console.log(
    "-".repeat(
      dateWidth +
        durationWidth +
        branchWidth +
        issueWidth +
        descWidth +
        syncedWidth
    )
  );

  // Print each worklog
  for (const log of filteredLogs) {
    const date = formatDate(log.startTime);
    const duration = formatDuration(log.startTime, log.endTime);
    const branch =
      log.branch.length > branchWidth - 3
        ? log.branch.substring(0, branchWidth - 3) + "..."
        : log.branch;
    const issueId = log.issueId.toString();
    const description = log.description
      ? log.description.length > descWidth - 3
        ? log.description.substring(0, descWidth - 3) + "..."
        : log.description
      : "N/A";
    const synced = log.synced ? chalk.green("✓") : chalk.red("✗");

    console.log(
      date.padEnd(dateWidth) +
        duration.padEnd(durationWidth) +
        branch.padEnd(branchWidth) +
        issueId.padEnd(issueWidth) +
        description.padEnd(descWidth) +
        synced.padEnd(syncedWidth)
    );
  }

  // Print summary
  const totalDurationMs = filteredLogs.reduce((total, log) => {
    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : new Date();
    return total + (end.getTime() - start.getTime());
  }, 0);

  const totalHours = Math.floor(totalDurationMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor(
    (totalDurationMs % (1000 * 60 * 60)) / (1000 * 60)
  );

  console.log(
    "\n" +
      "-".repeat(
        dateWidth +
          durationWidth +
          branchWidth +
          issueWidth +
          descWidth +
          syncedWidth
      )
  );
  console.log(chalk.bold(`Total: ${totalHours}h ${totalMinutes}m`));

  // Show synced vs unsynced stats
  const syncedLogs = filteredLogs.filter((log) => log.synced);
  const unsyncedLogs = filteredLogs.filter((log) => !log.synced);

  console.log(chalk.green(`Synced: ${syncedLogs.length} worklogs`));
  console.log(chalk.yellow(`Unsynced: ${unsyncedLogs.length} worklogs`));
}

/**
 * Implementation for the 'activity list' command
 */
export function implementActivityListCommand(program: Command) {
  const activityCmd = program.command("activity");

  activityCmd
    .command("list")
    .description("List all tracked worklogs")
    .option("-l, --limit <number>", "Limit the number of worklogs shown", "10")
    .option("-d, --date <date>", "Filter by date (YYYY-MM-DD)")
    .option("-b, --branch <name>", "Filter by branch name")
    .option("-i, --issue <id>", "Filter by issue ID")
    .option("-a, --all", "Show all worklogs")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      try {
        await displayWorklogs({
          limit: options.limit ? parseInt(options.limit) : 10,
          date: options.date,
          branch: options.branch,
          issueId: options.issue ? parseInt(options.issue) : undefined,
          all: options.all || false,
          format: options.json ? "json" : "table",
        });
      } catch (error: any) {
        console.error(chalk.red("✗ Error displaying worklogs:"), error.message);
      }
    });

  return activityCmd;
}

/**
 * IMPLEMENTATION NOTES
 *
 * This prototype adds a new 'activity list' command that displays worklogs in a table format.
 *
 * Features:
 * - Table display with columns for date, duration, branch, issue ID, description, and sync status
 * - Filtering by date, branch, and issue ID
 * - Limiting the number of worklogs shown
 * - Option to show all worklogs
 * - JSON output option for integration with other tools
 * - Summary statistics showing total time and sync status
 *
 * To integrate this into the main application:
 * 1. Import implementActivityListCommand from this file
 * 2. Call it in the main index.ts file, passing the program object
 * 3. This will add the 'activity list' command to the existing 'activity' command
 */
