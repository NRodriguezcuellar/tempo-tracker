/**
 * CLI entry point for Tempo CLI
 *
 * Defines the command structure and delegates to command handlers
 */

import { Command } from "commander";
import {
  startTrackingWithErrorHandling,
  stopTrackingWithErrorHandling,
  statusTrackingWithErrorHandling,
  syncTempoWithErrorHandling,
  setApiKeyCommand,
  setJiraAccountIdCommand,
  showConfigCommand,
  listLogsCommand,
  clearLogsCommand,
  setupCommand,
  startDaemonWithErrorHandling,
  stopDaemonWithErrorHandling,
  statusDaemonWithErrorHandling,
  viewDaemonLogsWithErrorHandling,
} from "./commands";

/**
 * Create and configure the CLI program
 */
export async function createCli(): Promise<Command> {
  const program = new Command();

  // Import the version from package.json dynamically
  const packageJson = await import("../../package.json", {
    assert: { type: "json" },
  });

  program
    .name("tempo")
    .description("Track time spent on git branches and sync with Tempo")
    .version(packageJson.default.version);

  // Start command
  program
    .command("start")
    .description("Start tracking time on the current branch")
    .option("-d, --description <description>", "Description of the work")
    .option("-i, --issue-id <issueId>", "Jira issue ID", parseInt)
    .action((options) => {
      startTrackingWithErrorHandling({
        description: options.description,
        issueId: options.issueId,
      });
    });

  // Stop command
  program
    .command("stop")
    .description("Stop tracking time on the current branch")
    .action(() => {
      stopTrackingWithErrorHandling();
    });

  // Status command
  program
    .command("status")
    .description("Show current tracking status")
    .action(() => {
      statusTrackingWithErrorHandling();
    });

  // Sync command
  program
    .command("sync")
    .description("Sync tracked time to Tempo")
    .option("-d, --date <date>", "Date to sync (YYYY-MM-DD), defaults to today")
    .action((options) => {
      syncTempoWithErrorHandling({
        date: options.date,
      });
    });

  // Config commands
  const configCommand = program
    .command("config")
    .description("Manage configuration");

  configCommand
    .command("set-api-key <key>")
    .description("Set Tempo API key")
    .action((key) => {
      setApiKeyCommand(key);
    });

  configCommand
    .command("set-jira-account-id <id>")
    .description("Set Jira account ID")
    .action((id) => {
      setJiraAccountIdCommand(id);
    });

  configCommand
    .command("show")
    .description("Show current configuration")
    .action(() => {
      showConfigCommand();
    });

  // Logs commands
  const logsCommand = program
    .command("logs")
    .description("Manage time tracking logs");

  logsCommand
    .command("list")
    .description("List time tracking logs")
    .option("-l, --limit <limit>", "Limit number of logs", parseInt)
    .option("-d, --date <date>", "Filter by date (YYYY-MM-DD)")
    .option("-b, --branch <branch>", "Filter by branch")
    .option("-i, --issue-id <issueId>", "Filter by issue ID", parseInt)
    .option("-a, --all", "Show all logs including synced ones")
    .option("-f, --format <format>", "Output format (table, json)")
    .action((options) => {
      listLogsCommand(options);
    });

  logsCommand
    .command("clear")
    .description("Clear all time tracking logs")
    .action(() => {
      clearLogsCommand();
    });

  // Setup command
  program
    .command("setup")
    .description("Setup Tempo CLI")
    .action(() => {
      setupCommand();
    });

  // Daemon commands
  const daemonCommand = program
    .command("daemon")
    .description("Manage the Tempo daemon");

  daemonCommand
    .command("start")
    .description("Start the Tempo daemon")
    .action(() => {
      startDaemonWithErrorHandling();
    });

  daemonCommand
    .command("stop")
    .description("Stop the Tempo daemon")
    .action(() => {
      stopDaemonWithErrorHandling();
    });

  daemonCommand
    .command("status")
    .description("Show daemon status")
    .action(() => {
      statusDaemonWithErrorHandling();
    });

  daemonCommand
    .command("logs")
    .description("View daemon logs")
    .option("-l, --lines <lines>", "Number of lines to show", parseInt)
    .action((options) => {
      viewDaemonLogsWithErrorHandling({
        lines: options.lines,
      });
    });

  return program;
}

/**
 * Run the CLI
 */
export async function runCli(): Promise<void> {
  const program = await createCli();
  program.parse(process.argv);
}
