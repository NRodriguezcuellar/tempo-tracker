/**
 * Tempo CLI Daemon Prototype
 *
 * This is a prototype implementation of a background daemon service for the Tempo CLI.
 * It allows tracking to persist across terminal sessions and directories.
 */

import { Command } from "commander";
import { startDaemon, stopDaemon, statusDaemon } from "./service";
import chalk from "chalk";

/**
 * Setup daemon commands for the CLI
 */
export function setupDaemonCommands(program: Command): void {
  const daemonCmd = program
    .command("daemon")
    .description("Manage the Tempo tracking daemon");

  daemonCmd
    .command("start")
    .description("Start the Tempo tracking daemon")
    .action(async () => {
      try {
        await startDaemon();
      } catch (error: any) {
        console.error(chalk.red("✗ Error starting daemon:"), error.message);
      }
    });

  daemonCmd
    .command("stop")
    .description("Stop the Tempo tracking daemon")
    .action(async () => {
      try {
        await stopDaemon();
      } catch (error: any) {
        console.error(chalk.red("✗ Error stopping daemon:"), error.message);
      }
    });

  daemonCmd
    .command("status")
    .description("Check the status of the Tempo tracking daemon")
    .action(async () => {
      try {
        await statusDaemon();
      } catch (error: any) {
        console.error(
          chalk.red("✗ Error checking daemon status:"),
          error.message
        );
      }
    });
}
