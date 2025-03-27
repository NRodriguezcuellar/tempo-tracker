/**
 * Tempo CLI Client
 *
 * A lightweight HTTP client that communicates with the backend server.
 * Used by the CLI and potentially other frontends.
 */

import axios from "axios";
import { TrackingSession } from "../core/tracking";
import { isDaemonRunning } from "../daemon";
import { findGitRoot, getCurrentBranch } from "../core/git";

// Constants
const SERVER_PORT = 39587;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const REQUEST_TIMEOUT_MS = 3000;

// Status response type
export interface StatusResponse {
  isRunning: boolean;
  activeSessions: TrackingSession[];
}

/**
 * Ensure the daemon is running before making requests
 */
async function ensureDaemonRunning(): Promise<void> {
  if (!(await isDaemonRunning())) {
    throw new Error(
      "Daemon is not running. Start it with 'tempo daemon start' first.",
    );
  }
}

/**
 * Get the status from the backend
 */
export async function getStatus(): Promise<StatusResponse> {
  await ensureDaemonRunning();

  try {
    const response = await axios.post(
      SERVER_URL,
      { command: "status" },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to get status");
    }

    return {
      isRunning: response.data.isRunning,
      activeSessions: response.data.activeSessions || [],
    };
  } catch (error: any) {
    handleAxiosError(error);
    throw error; // This will only be reached if handleAxiosError doesn't throw
  }
}

/**
 * Start tracking time in the current directory
 */
export async function startTracking(options: {
  description?: string;
  issueId?: number;
}): Promise<TrackingSession> {
  await ensureDaemonRunning();

  // Get the current working directory
  const cwd = process.cwd();

  // Check if we're in a git repository
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error(
      "Not in a git repository. Please navigate to a git repository to start tracking.",
    );
  }

  // Get the current branch
  const branch = await getCurrentBranch(gitRoot);

  try {
    // Send start tracking request
    const response = await axios.post(
      SERVER_URL,
      {
        command: "start",
        params: {
          branch,
          directory: gitRoot,
          issueId: options.issueId,
          description: options.description,
        },
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to start tracking");
    }

    return response.data.session;
  } catch (error: any) {
    handleAxiosError(error);
    throw error;
  }
}

/**
 * Stop tracking time in the current directory
 */
export async function stopTracking(): Promise<TrackingSession | null> {
  await ensureDaemonRunning();

  // Get the current working directory
  const cwd = process.cwd();

  // Check if we're in a git repository
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error(
      "Not in a git repository. Please navigate to a git repository to stop tracking.",
    );
  }

  try {
    // Send stop tracking request
    const response = await axios.post(
      SERVER_URL,
      {
        command: "stop",
        params: {
          directory: gitRoot,
        },
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to stop tracking");
    }

    return response.data.session;
  } catch (error: any) {
    handleAxiosError(error);
    throw error;
  }
}

/**
 * Sync with Tempo
 */
export async function syncTempo(options: {
  date?: string;
}): Promise<{ synced: number; failed: number }> {
  await ensureDaemonRunning();

  try {
    // Send sync request
    const response = await axios.post(
      SERVER_URL,
      {
        command: "sync",
        params: options,
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to sync with Tempo");
    }

    return response.data.result;
  } catch (error: any) {
    handleAxiosError(error);
    throw error;
  }
}

/**
 * Handle Axios errors with user-friendly messages
 */
function handleAxiosError(error: any): never {
  if (error.isAxiosError) {
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        "Cannot connect to daemon. Please ensure it's running with 'tempo daemon start'.",
      );
    } else if (error.code === "ETIMEDOUT") {
      throw new Error(
        "Connection to daemon timed out. The daemon may be overloaded or not responding.",
      );
    } else if (error.response) {
      throw new Error(
        `Server error: ${error.response.data?.error || error.message}`,
      );
    }
  }

  throw error;
}
