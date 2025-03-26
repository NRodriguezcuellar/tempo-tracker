/**
 * Tempo CLI Daemon Service
 *
 * Core service implementation for the Tempo CLI daemon.
 * Handles daemon lifecycle and management using a direct Node.js process.
 */

import { spawn } from "child_process";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import os from "os";
import { isDaemonRunning, getStatusFromDaemon } from "./client";

// Constants
const LOG_DIR = path.join(os.tmpdir(), "tempo-daemon");
const PID_FILE = path.join(LOG_DIR, "daemon.pid");
const LOG_FILE = path.join(LOG_DIR, "daemon.log");

// Get the path to the daemon script
const getDaemonScriptPath = (): string => {
  // Get the path to the built daemon script
  const distPath = path.resolve(__dirname, "..", "..", "dist");
  return path.join(distPath, "server.js");
};

/**
 * Ensure the log directory exists
 */
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Start the daemon process
 */
export async function startDaemon(): Promise<void> {
  // Check if daemon is already running
  if (await isDaemonRunning()) {
    console.log(chalk.yellow("Tempo daemon is already running."));
    return;
  }

  // Ensure log directory exists
  ensureLogDir();

  // Get daemon script path
  const daemonScriptPath = getDaemonScriptPath();

  // Check if daemon script exists
  if (!fs.existsSync(daemonScriptPath)) {
    throw new Error(
      `Daemon script not found at ${daemonScriptPath}. Make sure to build the project first.`
    );
  }

  // Start the daemon process
  try {
    // Use spawn instead of exec to properly detach the process
    const daemon = spawn("node", [daemonScriptPath], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });

    // Detach the child process
    daemon.unref();

    // Wait a bit for the daemon to start
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if daemon started successfully
    if (await isDaemonRunning()) {
      console.log(chalk.green("✓ Tempo daemon started successfully"));
      console.log(
        chalk.blue(
          "The daemon will now track your time across terminal sessions."
        )
      );
    } else {
      throw new Error("Daemon process didn't start properly.");
    }
  } catch (error: any) {
    throw new Error(`Failed to start daemon: ${error.message}`);
  }
}

/**
 * Stop the daemon process
 */
export async function stopDaemon(): Promise<void> {
  // Check if daemon is running
  if (!(await isDaemonRunning())) {
    console.log(chalk.yellow("Tempo daemon is not running."));
    return;
  }

  try {
    // Read PID from file
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim());

      if (isNaN(pid)) {
        throw new Error("Invalid PID in PID file");
      }

      // Send SIGTERM to the process
      process.kill(pid, "SIGTERM");

      // Wait a bit for the process to exit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Remove PID file if it still exists
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }

      console.log(chalk.green("✓ Tempo daemon stopped successfully"));
    } else {
      throw new Error("PID file not found");
    }
  } catch (error: any) {
    // If the process doesn't exist anymore, just clean up
    if (error.code === "ESRCH") {
      // Process doesn't exist, clean up PID file
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
      console.log(chalk.green("✓ Tempo daemon stopped successfully"));
    } else {
      throw new Error(`Failed to stop daemon: ${error.message}`);
    }
  }
}

/**
 * Check the status of the daemon
 */
export async function statusDaemon(): Promise<void> {
  // Check if daemon is running
  const isRunning = await isDaemonRunning();

  if (isRunning) {
    console.log(chalk.green("✓ Tempo daemon is running"));

    try {
      // Get daemon status
      const status = await getStatusFromDaemon();

      // Display active tracking sessions if any
      if (status.activeSessions.length > 0) {
        console.log(chalk.blue("\nActive tracking sessions:"));

        for (const session of status.activeSessions) {
          console.log(`\n  Repository: ${chalk.cyan(session.directory)}`);
          console.log(`  Branch: ${chalk.cyan(session.branch)}`);
          console.log(
            `  Started: ${chalk.cyan(
              new Date(session.startTime).toLocaleString()
            )}`
          );

          if (session.issueId) {
            console.log(`  Issue: ${chalk.cyan(session.issueId)}`);
          }

          if (session.description) {
            console.log(`  Description: ${chalk.cyan(session.description)}`);
          }

          // Calculate duration
          const startTime = new Date(session.startTime);
          const now = new Date();
          const durationMs = now.getTime() - startTime.getTime();
          const durationMinutes = Math.round(durationMs / 60000);
          const hours = Math.floor(durationMinutes / 60);
          const minutes = durationMinutes % 60;

          console.log(`  Duration: ${chalk.cyan(`${hours}h ${minutes}m`)}`);
        }
      } else {
        console.log(chalk.yellow("\nNo active tracking sessions."));
      }
    } catch (error: any) {
      console.log(
        chalk.yellow(`\nError getting daemon status: ${error.message}`)
      );
    }
  } else {
    console.log(chalk.yellow("Tempo daemon is not running."));
    console.log(chalk.blue("Start the daemon with: tempo daemon start"));
  }
}
