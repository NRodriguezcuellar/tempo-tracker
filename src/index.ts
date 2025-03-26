#!/usr/bin/env node

import { Command } from "commander";
import {
  startTracking,
  stopTracking,
  statusTracking,
  syncTempo,
  setApiKeyCommand,
  showConfigCommand,
  setJiraAccountIdCommand,
  setupCommand,
  clearLogsCommand,
  listLogsCommand,
  startDaemonWithErrorHandling,
  stopDaemonWithErrorHandling,
  statusDaemonWithErrorHandling,
  startTrackingViaDaemonWithErrorHandling,
  stopTrackingViaDaemonWithErrorHandling,
} from "./commands";
import { initConfig } from "./config";
import chalk from "chalk";

// Initialize
async function main() {
  await initConfig();

  const program = new Command();

  program
    .name("tempo-tracker")
    .description("Track time spent on git branches and sync with Tempo")
    .version("1.0.0");

  program
    .command("start")
    .description("Start tracking time on current branch")
    .option("-d, --description <text>", "Description of the work being done")
    .option("-i, --issue <id>", "Jira issueId")
    .action(async (options) => {
      try {
        await startTracking(options);
      } catch (error: any) {
        console.error(chalk.red("✗ Error starting tracking:"), error);
      }
    });

  program
    .command("stop")
    .description("Stop tracking time on current branch")
    .action(async () => {
      try {
        await stopTracking();
      } catch (error: any) {
        console.error(chalk.red("✗ Error stopping tracking:"), error);
      }
    });

  program
    .command("status")
    .description("Show current tracking status")
    .action(async () => {
      try {
        await statusTracking();
      } catch (error: any) {
        console.error(chalk.red("✗ Error getting status:"), error);
      }
    });

  program
    .command("sync")
    .description("Sync tracked time to Tempo")
    .option(
      "-d, --date <date>",
      "Date to sync (default: today)",
      new Date().toISOString().split("T")[0]
    )
    .action(async (options) => {
      try {
        await syncTempo(options);
      } catch (error: any) {
        console.error(chalk.red("✗ Error syncing to Tempo:"), error);
      }
    });

  const configCmd = program
    .command("config")
    .description("Manage configuration settings");

  configCmd
    .command("set-api-key <key>")
    .description("Store Tempo API key")
    .action(setApiKeyCommand);

  configCmd
    .command("set-jira-account-id <id>")
    .description("Configure Jira account ID")
    .action(setJiraAccountIdCommand);

  configCmd
    .command("show")
    .description("Display current configuration")
    .action(showConfigCommand);

  // Logs commands (replaces the old 'activity' command)
  const logsCmd = program
    .command("logs")
    .description("Manage time tracking logs");

  logsCmd
    .command("list")
    .description("List all tracked worklogs")
    .option("-l, --limit <number>", "Limit the number of worklogs shown", "10")
    .option("-d, --date <date>", "Filter by date (YYYY-MM-DD)")
    .option("-b, --branch <name>", "Filter by branch name")
    .option("-i, --issue <id>", "Filter by issue ID")
    .option("-a, --all", "Show all worklogs")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      await listLogsCommand({
        limit: options.limit ? parseInt(options.limit) : 10,
        date: options.date,
        branch: options.branch,
        issueId: options.issue ? parseInt(options.issue) : undefined,
        all: options.all || false,
        format: options.json ? "json" : "table",
      });
    });

  logsCmd
    .command("clear")
    .description("Remove all local logs")
    .action(clearLogsCommand);

  // Daemon commands
  const daemonCmd = program
    .command("daemon")
    .description("Manage the Tempo daemon process");

  daemonCmd
    .command("start")
    .description("Start the Tempo daemon process")
    .action(startDaemonWithErrorHandling);

  daemonCmd
    .command("stop")
    .description("Stop the Tempo daemon process")
    .action(stopDaemonWithErrorHandling);

  daemonCmd
    .command("status")
    .description("Check the status of the Tempo daemon process")
    .action(statusDaemonWithErrorHandling);

  // Daemon tracking commands
  program
    .command("daemon-start")
    .description("Start tracking time via the daemon")
    .option("-d, --description <description>", "Description of the work")
    .option("-i, --issue-id <issueId>", "Jira issue ID")
    .action((options) => {
      startTrackingViaDaemonWithErrorHandling({
        description: options.description,
        issueId: options.issueId ? parseInt(options.issueId) : undefined,
      });
    });

  program
    .command("daemon-stop")
    .description("Stop tracking time via the daemon")
    .action(stopTrackingViaDaemonWithErrorHandling);

  program
    .command("setup")
    .description("Configure Tempo API key and Jira Account ID")
    .action(() => {
      setupCommand().catch((error: any) => {
        console.error(chalk.red("✗ Error setting up:"), error);
      });
    });

  await program.parseAsync(process.argv);
}

main();
