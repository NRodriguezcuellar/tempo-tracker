/**
 * Tempo CLI Daemon
 *
 * Manages the lifecycle of the backend process
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import chalk from "chalk";

// Constants
const LOG_DIR = path.join(os.tmpdir(), "tempo-daemon");
const PID_FILE = path.join(LOG_DIR, "daemon.pid");
const LOG_FILE = path.join(LOG_DIR, "daemon.log");

/**
 * Get the path to the backend script
 */
function getBackendScriptPath(): string {
  // First try to find the backend script in the same directory as this file
  const sameDir = path.join(__dirname, "backend.js");
  if (fs.existsSync(sameDir)) {
    return sameDir;
  }
  
  // Next try to find it in the standard dist directory (development environment)
  const distPath = path.resolve(__dirname, "..", "..", "dist");
  const distFile = path.join(distPath, "backend.js");
  if (fs.existsSync(distFile)) {
    return distFile;
  }
   
  // If all else fails, return the standard path (will error with a helpful message)
  return path.join(distPath, "backend.js");
}

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
  // Ensure log directory exists
  ensureLogDir();

  // Get backend script path
  const backendScriptPath = getBackendScriptPath();

  // Check if backend script exists
  if (!fs.existsSync(backendScriptPath)) {
    throw new Error(
      `Backend script not found at ${backendScriptPath}. Make sure to build the project first.`,
    );
  }

  // Start the daemon process
  try {
    // Use spawn instead of exec to properly detach the process
    const daemon = spawn("node", [backendScriptPath], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });

    // Write PID to file
    fs.writeFileSync(PID_FILE, daemon.pid?.toString() || "");

    // Detach the child process
    daemon.unref();

    // Wait a bit for the daemon to start
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(chalk.green("✓ Tempo daemon started successfully"));
    console.log(
      chalk.blue(
        "The daemon will now track your time across terminal sessions.",
      ),
    );
  } catch (error: any) {
    throw new Error(`Failed to start daemon: ${error.message}`);
  }
}

/**
 * Stop the daemon process
 */
export async function stopDaemon(): Promise<void> {
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
 * Check if the daemon is running
 */
export function isDaemonRunning(): boolean {
  // First check if the PID file exists
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }

  try {
    // Read the PID file
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim());

    if (isNaN(pid)) {
      return false;
    }

    // Check if the process exists
    try {
      // This doesn't actually send a signal, just checks if the process exists
      process.kill(pid, 0);
      return true;
    } catch (e) {
      // Either the process doesn't exist or we can't send signals to it
      return false;
    }
  } catch (e) {
    // Any error means the daemon is not running properly
    return false;
  }
}

/**
 * View the daemon logs
 */
export function viewDaemonLogs(options: { lines?: number } = {}): string[] {
  const lines = options.lines || 50;

  if (!fs.existsSync(LOG_FILE)) {
    throw new Error("Daemon log file not found");
  }

  // Read the log file
  const logContent = fs.readFileSync(LOG_FILE, "utf8");

  // Split into lines and get the last N lines
  const logLines = logContent.split("\n").filter(Boolean);
  const lastLines = logLines.slice(-lines);

  return lastLines;
}

/**
 * Get the daemon status
 */
export function getDaemonStatus(): { isRunning: boolean; pid?: number } {
  const isRunning = isDaemonRunning();

  if (!isRunning) {
    return { isRunning: false };
  }

  // Read PID from file
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim());

    if (!isNaN(pid)) {
      return { isRunning: true, pid };
    }
  }

  return { isRunning: true };
}
