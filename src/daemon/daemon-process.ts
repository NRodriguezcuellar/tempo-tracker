#!/usr/bin/env node
/**
 * Tempo CLI Daemon Process
 *
 * Main entry point for the background daemon process.
 * This file is executed by PM2 when the daemon is started.
 */

import {
  initDaemonState,
  getDaemonState,
  addActiveSession,
  removeActiveSession,
} from "./state";
import { IPCServer, MessageType } from "./ipc";
import { isGitDirectory } from "../git";
import { sendTempoPulse } from "../api";
import { getConfig, updateConfig } from "../config";
import path from "path";
import fs from "fs";
import os from "os";

// Constants
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const PULSE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRACKING_TIME_MS = 8 * 60 * 60 * 1000; // 8 hours

// Intervals
let idleCheckInterval: NodeJS.Timeout | null = null;
let pulseInterval: NodeJS.Timeout | null = null;

// IPC Server instance
let ipcServer: IPCServer | null = null;

// Log file path
const LOG_FILE_PATH = path.join(os.tmpdir(), "tempo-daemon", "daemon.log");

/**
 * Write a log message to the daemon log file
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  // Ensure log directory exists
  const logDir = path.dirname(LOG_FILE_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Append to log file
  fs.appendFileSync(LOG_FILE_PATH, logMessage);
}

/**
 * Initialize the daemon process
 */
async function initDaemon(): Promise<void> {
  try {
    log("Initializing daemon process");

    // Initialize daemon state
    await initDaemonState();

    // Initialize and start IPC server
    ipcServer = new IPCServer();
    await ipcServer.start();
    log(`IPC server started at ${path.join(os.tmpdir(), 'tempo-daemon', 'ipc.sock')}`);

    // Start idle checking
    startIdleChecking();

    // Start pulse sending
    startPulseSending();

    log("Daemon process initialized successfully");
  } catch (error: any) {
    log(`Error initializing daemon: ${error.message}`);
  }
}

/**
 * Start idle checking interval
 */
function startIdleChecking(): void {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
  }

  idleCheckInterval = setInterval(checkIdleStatus, IDLE_CHECK_INTERVAL_MS);
  log("Started idle checking interval");
}

/**
 * Stop idle checking interval
 */
function stopIdleChecking(): void {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
    log("Stopped idle checking interval");
  }
}

/**
 * Check for idle tracking sessions
 */
async function checkIdleStatus(): Promise<void> {
  try {
    const state = await getDaemonState();

    // Check each active session
    for (const session of state.activeSessions) {
      const startTime = new Date(session.startTime);
      const now = new Date();
      const durationMs = now.getTime() - startTime.getTime();

      // Check if session has exceeded maximum tracking time
      if (durationMs > MAX_TRACKING_TIME_MS) {
        log(
          `Session ${session.id} has exceeded maximum tracking time, stopping automatically`
        );
        await stopTrackingSession(session.id);
      }

      // TODO: Implement more sophisticated idle detection
      // This could include checking for user activity, git operations, etc.
    }
  } catch (error: any) {
    log(`Error checking idle status: ${error.message}`);
  }
}

/**
 * Start pulse sending interval
 */
function startPulseSending(): void {
  if (pulseInterval) {
    clearInterval(pulseInterval);
  }

  pulseInterval = setInterval(sendPulses, PULSE_INTERVAL_MS);
  log("Started pulse sending interval");
}

/**
 * Stop pulse sending interval
 */
function stopPulseSending(): void {
  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
    log("Stopped pulse sending interval");
  }
}

/**
 * Send pulses for active tracking sessions
 */
async function sendPulses(): Promise<void> {
  try {
    const state = await getDaemonState();
    const config = await getConfig();

    // Check if API key is configured
    if (!config.apiKey) {
      log("API key not configured, skipping pulse sending");
      return;
    }

    // Send pulses for each active session
    for (const session of state.activeSessions) {
      try {
        if (session.issueId) {
          await sendTempoPulse({
            issueId: session.issueId,
            description: session.description,
          });

          log(
            `Sent pulse for session ${session.id} (issue: ${session.issueId})`
          );
        }
      } catch (error: any) {
        log(`Error sending pulse for session ${session.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    log(`Error sending pulses: ${error.message}`);
  }
}

/**
 * Start tracking in a directory
 */
async function startTrackingSession(
  directory: string,
  branch: string,
  issueId?: number,
  description?: string
): Promise<void> {
  try {
    // Check if directory is a git repository
    if (!(await isGitDirectory(directory))) {
      throw new Error(`Directory is not a git repository: ${directory}`);
    }

    // Add new active session
    const session = await addActiveSession({
      branch,
      directory,
      startTime: new Date().toISOString(),
      issueId,
      description,
    });

    log(
      `Started tracking session ${session.id} (branch: ${branch}, directory: ${directory})`
    );
  } catch (error: any) {
    log(`Error starting tracking session: ${error.message}`);
    throw error;
  }
}

/**
 * Stop tracking session
 */
async function stopTrackingSession(sessionId: string): Promise<void> {
  try {
    const state = await getDaemonState();
    const session = state.activeSessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Calculate duration
    const startTime = new Date(session.startTime);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    // Add to activity log
    const config = await getConfig();
    const activityLog = config.activityLog || [];
    activityLog.push({
      id: sessionId,
      branch: session.branch,
      directory: session.directory,
      startTime: session.startTime,
      endTime: endTime.toISOString(),
      issueId: session.issueId || 0, // Default to 0 if undefined
      description: session.description,
      synced: false,
    });
    await updateConfig({ activityLog });

    // Remove from active sessions
    await removeActiveSession(sessionId);

    log(
      `Stopped tracking session ${sessionId} (duration: ${durationMinutes} minutes)`
    );
  } catch (error: any) {
    log(`Error stopping tracking session: ${error.message}`);
    throw error;
  }
}

/**
 * Cleanup function to be called when daemon is stopped
 */
function cleanup(): void {
  log("Cleaning up daemon process");

  // Stop intervals
  stopIdleChecking();
  stopPulseSending();

  log("Daemon process cleanup complete");
  process.exit(0);
}

// Handle process signals
process.on("SIGINT", () => {
  log("Received SIGINT signal");
  cleanup();
});

process.on("SIGTERM", () => {
  log("Received SIGTERM signal");
  cleanup();
});

// Initialize daemon when this script is executed
initDaemon().catch((error) => {
  log(`Fatal error in daemon process: ${error.message}`);
  process.exit(1);
});

// Log daemon startup
log("Daemon process started");
