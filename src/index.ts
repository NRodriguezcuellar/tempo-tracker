#!/usr/bin/env bun

import { Command } from "commander";
import {
  startTracking,
  stopTracking,
  statusTracking,
  syncTempo,
  setApiKeyCommand,
  setJiraInstanceCommand,
  showConfigCommand,
} from "./commands";
import { initConfig } from "./config";
import { authenticate } from "./auth";
import chalk from "chalk";
import "./commands";

// Initialize
async function main() {
  await initConfig();

  const program = new Command();

  program
    .name("tempo-tracker")
    .description("Track time spent on git branches and sync with Tempo")
    .version("1.0.0");

  program
    .command("auth")
    .description("Authenticate with Jira/Tempo")
    .action(async () => {
      try {
        await authenticate();
        console.log(chalk.green("✓ Authentication successful!"));
      } catch (error) {
        console.error(chalk.red("✗ Authentication failed:"), error);
      }
    });

  program
    .command("start")
    .description("Start tracking time on current branch")
    .option("-d, --description <text>", "Description of the work being done")
    .option("-i, --issue <key>", "Jira issue key")
    .action(async (options) => {
      try {
        await startTracking(options);
      } catch (error) {
        console.error(chalk.red("✗ Error starting tracking:"), error);
      }
    });

  program
    .command("stop")
    .description("Stop tracking time on current branch")
    .action(async () => {
      try {
        await stopTracking();
      } catch (error) {
        console.error(chalk.red("✗ Error stopping tracking:"), error);
      }
    });

  program
    .command("status")
    .description("Show current tracking status")
    .action(async () => {
      try {
        await statusTracking();
      } catch (error) {
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
      } catch (error) {
        console.error(chalk.red("✗ Error syncing to Tempo:"), error);
      }
    });

  const configCmd = program.command('config')
    .description('Manage configuration settings');

  configCmd
    .command('set-api-key <key>')
    .description('Store Tempo API key')
    .action(setApiKeyCommand);

  configCmd
    .command('set-jira-instance <url>')
    .description('Configure Jira instance URL')
    .action(setJiraInstanceCommand);

  configCmd
    .command('show')
    .description('Display current configuration')
    .action(showConfigCommand);

  await program.parseAsync(process.argv);
}

main();
