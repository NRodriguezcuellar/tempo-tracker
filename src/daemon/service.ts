/**
 * Tempo CLI Daemon Service
 *
 * Core service implementation for the Tempo CLI daemon.
 * Handles daemon lifecycle and management using PM2.
 */

import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { initDaemonState, getDaemonState } from "./state";

const execAsync = promisify(exec);

// Get the path to the daemon script
const getDaemonScriptPath = (): string => {
  // Get the path to the built daemon script
  const distPath = path.resolve(__dirname, "..", "..", "dist");
  return path.join(distPath, "daemon-process.js");
};

/**
 * Check if PM2 is installed
 */
async function checkPM2Installed(): Promise<boolean> {
  try {
    await execAsync("pm2 --version");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Install PM2 if not already installed
 */
async function ensurePM2Installed(): Promise<void> {
  if (!(await checkPM2Installed())) {
    console.log(chalk.yellow("PM2 is not installed. Installing PM2..."));
    try {
      await execAsync("npm install -g pm2");
      console.log(chalk.green("✓ PM2 installed successfully"));
    } catch (error: any) {
      throw new Error(`Failed to install PM2: ${error.message}`);
    }
  }
}

/**
 * Check if the daemon is running
 */
export async function isDaemonRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("pm2 list --no-color");
    return stdout.includes("tempo-daemon");
  } catch (error) {
    return false;
  }
}

/**
 * Start the daemon process
 */
export async function startDaemon(): Promise<void> {
  // Initialize daemon state
  await initDaemonState();

  // Ensure PM2 is installed
  await ensurePM2Installed();

  // Check if daemon is already running
  if (await isDaemonRunning()) {
    console.log(chalk.yellow("Tempo daemon is already running."));
    return;
  }

  // Get daemon script path
  const daemonScriptPath = getDaemonScriptPath();

  // Start the daemon with PM2
  try {
    await execAsync(`pm2 start ${daemonScriptPath} --name tempo-daemon`);
    console.log(chalk.green("✓ Tempo daemon started successfully"));
    console.log(
      chalk.blue(
        "The daemon will now track your time across terminal sessions."
      )
    );
  } catch (error: any) {
    throw new Error(`Failed to start daemon: ${error.message}`);
  }
}

/**
 * Stop the daemon process
 */
export async function stopDaemon(): Promise<void> {
  // Ensure PM2 is installed
  await ensurePM2Installed();

  // Check if daemon is running
  if (!(await isDaemonRunning())) {
    console.log(chalk.yellow("Tempo daemon is not running."));
    return;
  }

  // Stop the daemon with PM2
  try {
    await execAsync("pm2 stop tempo-daemon");
    await execAsync("pm2 delete tempo-daemon");
    console.log(chalk.green("✓ Tempo daemon stopped successfully"));
  } catch (error: any) {
    throw new Error(`Failed to stop daemon: ${error.message}`);
  }
}

/**
 * Check the status of the daemon
 */
export async function statusDaemon(): Promise<void> {
  // Ensure PM2 is installed
  await ensurePM2Installed();

  // Check if daemon is running
  const isRunning = await isDaemonRunning();

  if (isRunning) {
    console.log(chalk.green("✓ Tempo daemon is running"));

    // Get daemon state
    const state = await getDaemonState();

    // Display active tracking sessions if any
    if (state.activeSessions.length > 0) {
      console.log(chalk.blue("\nActive tracking sessions:"));

      for (const session of state.activeSessions) {
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
  } else {
    console.log(chalk.yellow("Tempo daemon is not running."));
    console.log(chalk.blue("Start the daemon with: tempo daemon start"));
  }
}
