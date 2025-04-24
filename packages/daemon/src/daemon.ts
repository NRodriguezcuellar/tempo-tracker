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
import { createDebugLogger } from "@tempo-tracker/core";

// Constants
const LOG_DIR = path.join(os.tmpdir(), "tempo-daemon");
const PID_FILE = path.join(LOG_DIR, "daemon.pid");
const LOG_FILE = path.join(LOG_DIR, "daemon.log");

// Create a debug logger for the daemon component
const debugLog = createDebugLogger("daemon");

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

  try {
    // Find the path to the backend executable
    // Try multiple possible locations for different installation scenarios
    const possibleBackendPaths = [
      // Local development or monorepo structure
      path.resolve(
        __dirname,
        "../node_modules/@tempo-tracker/backend/dist/index.js"
      ),
      // Global npm installation
      path.resolve(__dirname, "../../backend/dist/index.js"),
      // Bundled app structure
      path.resolve(__dirname, "../backend/index.js"),
      // Fallback for other installation methods
      path.resolve(
        process.cwd(),
        "node_modules/@tempo-tracker/backend/dist/index.js"
      ),
    ];

    // Find the first path that exists
    const backendPath = possibleBackendPaths.find((p) => fs.existsSync(p));

    // Check if we found a valid backend path
    if (!backendPath) {
      throw new Error(
        `Backend executable not found. Tried: ${possibleBackendPaths.join(", ")}`
      );
    }

    debugLog(`Starting backend from: ${backendPath}`);

    // Use spawn to properly detach the process
    const daemon = spawn("node", [backendPath], {
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
  const { lines = 50 } = options;

  try {
    if (!fs.existsSync(LOG_FILE)) {
      return ["No daemon logs found"];
    }

    // Read the file
    const content = fs.readFileSync(LOG_FILE, "utf8");

    // Split into lines and get the last N lines
    const allLines = content.split("\n");
    const lastLines = allLines.slice(-lines);

    return lastLines;
  } catch (error: any) {
    return [`Error reading daemon logs: ${error.message}`];
  }
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
