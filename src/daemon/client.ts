/**
 * Tempo CLI Daemon Client
 * 
 * A lightweight HTTP client that communicates with the daemon server.
 * Used by the CLI commands to interact with the daemon.
 */

import axios from 'axios';
import chalk from 'chalk';
import { findGitRoot, getCurrentBranch } from '../git';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Constants
const SERVER_PORT = 39587;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const LOG_DIR = path.join(os.tmpdir(), 'tempo-daemon');
const PID_FILE = path.join(LOG_DIR, 'daemon.pid');
const REQUEST_TIMEOUT_MS = 3000;

// Status response type
export interface StatusResponse {
  isRunning: boolean;
  activeSessions: Array<{
    id: string;
    branch: string;
    directory: string;
    startTime: string;
    issueId?: number;
    description?: string;
  }>;
}

/**
 * Check if the daemon is running
 */
export async function isDaemonRunning(): Promise<boolean> {
  // First check if the PID file exists
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }
  
  try {
    // Read the PID file
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    
    // On Linux, check if the process exists
    if (process.platform === 'linux') {
      try {
        // This doesn't actually send a signal, just checks if the process exists
        process.kill(pid, 0);
        
        // If we got here, the process exists
        // Now make a quick request to verify the daemon is responsive
        const response = await axios.post(
          SERVER_URL,
          { command: 'status' },
          { timeout: REQUEST_TIMEOUT_MS }
        );
        
        return response.data.success;
      } catch (e) {
        // Either the process doesn't exist or we can't send signals to it
        return false;
      }
    } else {
      // On other platforms, just try to make a request
      try {
        const response = await axios.post(
          SERVER_URL,
          { command: 'status' },
          { timeout: REQUEST_TIMEOUT_MS }
        );
        
        return response.data.success;
      } catch (e) {
        return false;
      }
    }
  } catch (e) {
    // Any error means the daemon is not running properly
    return false;
  }
}

/**
 * Start tracking time in the current directory
 */
export async function startTrackingViaDaemon(options: {
  description?: string;
  issueId?: number;
}): Promise<void> {
  // Get the current working directory
  const cwd = process.cwd();

  // Check if we're in a git repository
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error(
      "Not in a git repository. Please navigate to a git repository to start tracking."
    );
  }

  // Get the current branch
  const branch = await getCurrentBranch(gitRoot);

  // Check if daemon is running
  if (!(await isDaemonRunning())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Send start tracking request
    const response = await axios.post(
      SERVER_URL,
      {
        command: 'start',
        params: {
          branch,
          directory: gitRoot,
          issueId: options.issueId,
          description: options.description,
        }
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to start tracking');
    }

    console.log(
      chalk.green("✓ Started tracking time on branch:"),
      chalk.cyan(branch)
    );
    if (options.issueId) {
      console.log(`  Issue: ${chalk.cyan(options.issueId)}`);
    }
    if (options.description) {
      console.log(`  Description: ${chalk.cyan(options.description)}`);
    }
    console.log(
      chalk.blue("  Tracking is being managed by the daemon process.")
    );
  } catch (error: any) {
    if (error.isAxiosError && error.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to daemon. Please ensure it's running with 'tempo daemon start'.");
    } else if (error.isAxiosError && error.code === 'ETIMEDOUT') {
      throw new Error("Connection to daemon timed out. The daemon may be overloaded or not responding.");
    } else {
      throw error;
    }
  }
}

/**
 * Stop tracking time in the current directory
 */
export async function stopTrackingViaDaemon(): Promise<void> {
  // Get the current working directory
  const cwd = process.cwd();

  // Check if we're in a git repository
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error(
      "Not in a git repository. Please navigate to a git repository to stop tracking."
    );
  }

  // Check if daemon is running
  if (!(await isDaemonRunning())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Send stop tracking request
    const response = await axios.post(
      SERVER_URL,
      {
        command: 'stop',
        params: {
          directory: gitRoot
        }
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to stop tracking');
    }

    console.log(chalk.green("✓ Stopped tracking time."));
    console.log(chalk.blue("  Activity saved and ready to sync with Tempo."));
  } catch (error: any) {
    if (error.isAxiosError && error.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to daemon. Please ensure it's running with 'tempo daemon start'.");
    } else if (error.isAxiosError && error.code === 'ETIMEDOUT') {
      throw new Error("Connection to daemon timed out. The daemon may be overloaded or not responding.");
    } else {
      throw error;
    }
  }
}

/**
 * Get daemon status and active sessions
 */
export async function getStatusFromDaemon(): Promise<StatusResponse> {
  // Check if daemon is running
  if (!(await isDaemonRunning())) {
    return {
      isRunning: false,
      activeSessions: []
    };
  }

  try {
    // Send status request
    const response = await axios.post(
      SERVER_URL,
      { command: 'status' },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get status');
    }

    return response.data.result;
  } catch (error: any) {
    if (error.isAxiosError && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
      return {
        isRunning: false,
        activeSessions: []
      };
    } else {
      throw error;
    }
  }
}

/**
 * Sync with Tempo via daemon
 */
export async function syncTempoViaDaemon(options: {
  date?: string;
}): Promise<void> {
  // Check if daemon is running
  if (!(await isDaemonRunning())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Send sync request
    const response = await axios.post(
      SERVER_URL,
      {
        command: 'sync',
        params: {
          date: options.date
        }
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to sync with Tempo');
    }

    console.log(chalk.green("✓ Successfully synced with Tempo."));
  } catch (error: any) {
    if (error.isAxiosError && error.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to daemon. Please ensure it's running with 'tempo daemon start'.");
    } else if (error.isAxiosError && error.code === 'ETIMEDOUT') {
      throw new Error("Connection to daemon timed out. The daemon may be overloaded or not responding.");
    } else {
      throw error;
    }
  }
}
