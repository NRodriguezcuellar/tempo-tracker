/**
 * Tempo CLI Daemon IPC Client Utilities
 * 
 * Client-side utilities for communicating with the daemon process.
 * Used by the CLI commands to interact with the daemon.
 */

import { IPCClient, StatusResponse } from './ipc';
import { getCurrentBranch, findGitRoot } from '../git';
import chalk from 'chalk';

// Singleton IPC client instance
let ipcClient: IPCClient | null = null;

/**
 * Get the IPC client instance
 */
export function getIPCClient(): IPCClient {
  if (!ipcClient) {
    ipcClient = new IPCClient();
  }
  return ipcClient;
}

/**
 * Check if the daemon is running
 */
export async function isDaemonRunning(): Promise<boolean> {
  const client = getIPCClient();
  try {
    return await client.connect();
  } catch (error) {
    return false;
  } finally {
    await client.disconnect();
  }
}

/**
 * Start tracking in the current directory via daemon
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

  // Connect to daemon
  const client = getIPCClient();
  if (!(await client.connect())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Start tracking
    await client.startTracking(
      gitRoot,
      branch,
      options.issueId,
      options.description
    );

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
    console.log(chalk.blue("  Tracking is being managed by the daemon process."));
  } finally {
    await client.disconnect();
  }
}

/**
 * Stop tracking in the current directory via daemon
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

  // Connect to daemon
  const client = getIPCClient();
  if (!(await client.connect())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Stop tracking
    await client.stopTracking(gitRoot);

    console.log(chalk.green("✓ Stopped tracking time."));
    console.log(chalk.blue("  Activity saved and ready to sync with Tempo."));
  } finally {
    await client.disconnect();
  }
}

/**
 * Get tracking status from daemon
 */
export async function getStatusFromDaemon(): Promise<StatusResponse> {
  // Connect to daemon
  const client = getIPCClient();
  if (!(await client.connect())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Get status
    return await client.getStatus();
  } finally {
    await client.disconnect();
  }
}

/**
 * Sync with Tempo via daemon
 */
export async function syncTempoViaDaemon(options: {
  date?: string;
}): Promise<void> {
  // Connect to daemon
  const client = getIPCClient();
  if (!(await client.connect())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first."
    );
  }

  try {
    // Sync with Tempo
    await client.syncTempo(options.date);

    console.log(chalk.green("✓ Synced with Tempo successfully."));
  } finally {
    await client.disconnect();
  }
}
