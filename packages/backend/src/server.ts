/**
 * Backend HTTP server for Tempo CLI
 *
 * Provides an HTTP API for interacting with the core functionality
 */

import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { z } from "zod";
import {
  // Core tracking functionality
  TrackingSession,
  startTracking,
  stopTracking,
  sendSessionPulse,
  isSessionExpired,
  hasBranchChanged,
  PULSE_INTERVAL_MS,
  // Config functionality
  getConfig,
  // Worklog functionality
  syncActivitiesForDate,
  // Git functionality
  getCurrentBranch,
} from "@tempo-tracker/core";

import {
  PORT,
  IDLE_CHECK_INTERVAL_MS,
  BRANCH_CHECK_INTERVAL_MS,
} from "@tempo-tracker/core";
const LOG_DIR = path.join(os.tmpdir(), "tempo-daemon");
const LOG_FILE = path.join(LOG_DIR, "daemon.log");
const STATE_FILE = path.join(LOG_DIR, "state.json");

// State
interface BackendState {
  activeSessions: TrackingSession[];
}

let state: BackendState = {
  activeSessions: [],
};

// Command schemas
const startTrackingSchema = z.object({
  branch: z.string(),
  directory: z.string(),
  issueId: z.number().optional(),
  description: z.string().optional(),
});

const stopTrackingSchema = z.object({
  directory: z.string(),
});

const syncTempoSchema = z.object({
  date: z.string().optional(),
});

// Server instance
let server: http.Server | null = null;
let idleCheckInterval: NodeJS.Timeout | null = null;
let pulseInterval: NodeJS.Timeout | null = null;
let branchCheckInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the log directory and file
 */
function initLogging() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  log("Tempo backend starting");
}

/**
 * Write to the log file
 */
export function log(message: string) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;

  fs.appendFileSync(LOG_FILE, entry);
}

/**
 * Load state from disk
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf8");
      state = JSON.parse(data);
      log(`State loaded: ${state.activeSessions.length} active sessions`);
    } else {
      log("No state file found, using default empty state");
    }
  } catch (error) {
    log(`Error loading state: ${error}`);
    // Continue with default state
  }
}

/**
 * Save state to disk
 */
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    log("State saved");
  } catch (error) {
    log(`Error saving state: ${error}`);
  }
}

/**
 * Handle start tracking request
 */
async function handleStartTracking(
  params: z.infer<typeof startTrackingSchema>
): Promise<TrackingSession> {
  // Check if already tracking in this directory
  const existingIndex = state.activeSessions.findIndex(
    (session) => session.directory === params.directory
  );

  // If already tracking, stop the previous session
  if (existingIndex !== -1) {
    const session = state.activeSessions[existingIndex];
    log(`Replacing existing session in ${params.directory}`);

    await stopTracking(session);

    // Remove from active sessions
    state.activeSessions.splice(existingIndex, 1);
  }

  // Create new session
  const session = await startTracking(params.directory, {
    issueId: params.issueId,
    description: params.description,
  });

  // Add to active sessions
  state.activeSessions.push(session);
  log(`Started tracking in ${params.directory} on branch ${params.branch}`);

  // Save state
  saveState();

  // Send initial pulse
  try {
    const config = await getConfig();
    if (config.apiKey) {
      await sendSessionPulse(session, config.apiKey, config.tempoBaseUrl);
      log(`Sent initial pulse for session ${session.id}`);
    }
  } catch (error) {
    log(`Error sending initial pulse for session ${session.id}: ${error}`);
    // Continue even if pulse fails
  }

  return session;
}

/**
 * Handle stop tracking request
 */
async function handleStopTracking(
  params: z.infer<typeof stopTrackingSchema>
): Promise<TrackingSession | null> {
  // Find the session for this directory
  const index = state.activeSessions.findIndex(
    (session) => session.directory === params.directory
  );

  if (index === -1) {
    log(`No active session found for ${params.directory}`);
    return null;
  }

  // Get the session
  const session = state.activeSessions[index];
  log(`Stopping tracking for session ${session.id} in ${session.directory}`);

  // Add to activity log
  await stopTracking(session);

  // Remove from active sessions
  state.activeSessions.splice(index, 1);

  // Save state
  saveState();

  return session;
}

/**
 * Handle sync tempo request
 */
async function handleSyncTempo(
  params: z.infer<typeof syncTempoSchema>
): Promise<{ synced: number; failed: number }> {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error("API key not configured");
  }

  if (!config.jiraAccountId) {
    throw new Error("Jira account ID not configured");
  }

  // Use provided date or today
  const date = params.date || new Date().toISOString().split("T")[0];

  // Sync activities for the date
  const result = await syncActivitiesForDate(
    date,
    config.jiraAccountId,
    config.apiKey,
    config.tempoBaseUrl
  );

  log(`Synced ${result.synced} activities, failed ${result.failed}`);

  return result;
}

/**
 * Check for idle sessions
 */
function checkIdleSessions() {
  const expiredSessions = state.activeSessions.filter(isSessionExpired);

  if (expiredSessions.length > 0) {
    log(`Found ${expiredSessions.length} expired sessions`);

    // Stop each expired session
    expiredSessions.forEach(async (session) => {
      try {
        await handleStopTracking({ directory: session.directory });
        log(`Auto-stopped expired session ${session.id}`);
      } catch (error) {
        log(`Error stopping expired session ${session.id}: ${error}`);
      }
    });
  }
}

/**
 * Check for branch changes in active sessions
 */
async function checkBranchChanges() {
  for (const session of state.activeSessions) {
    try {
      // Check if branch has changed
      const branchChanged = await hasBranchChanged(session);

      if (branchChanged) {
        log(`Branch changed for session ${session.id} in ${session.directory}`);

        // Stop the current session
        await handleStopTracking({ directory: session.directory });

        // Start a new session with the new branch
        const newBranch = await getCurrentBranch(session.directory);

        await handleStartTracking({
          branch: newBranch,
          directory: session.directory,
          issueId: session.issueId,
          description: session.description,
        });

        log(`Started new session for branch ${newBranch}`);
      }
    } catch (error) {
      log(`Error checking branch for session ${session.id}: ${error}`);
    }
  }
}

/**
 * Send pulses for active sessions
 */
async function sendPulses() {
  const config = await getConfig();

  if (!config.apiKey) {
    log("API key not configured, skipping pulses");
    return;
  }

  for (const session of state.activeSessions) {
    try {
      await sendSessionPulse(session, config.apiKey, config.tempoBaseUrl);
      log(`Sent pulse for session ${session.id}`);
    } catch (error) {
      log(`Error sending pulse for session ${session.id}: ${error}`);
    }
  }
}

/**
 * Start the server
 */
export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Initialize logging
    initLogging();

    // Load state
    loadState();

    // Create server
    server = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      // Handle OPTIONS request
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      // Only accept POST requests
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end(
          JSON.stringify({ success: false, error: "Method not allowed" })
        );
        return;
      }

      // Parse request body
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const command = data.command;

          // Handle commands
          switch (command) {
            case "start": {
              try {
                const params = startTrackingSchema.parse(data.params);
                const session = await handleStartTracking(params);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, session }));
              } catch (error: any) {
                log(`Error handling start command: ${error.message}`);
                res.statusCode = 400;
                res.end(
                  JSON.stringify({ success: false, error: error.message })
                );
              }
              break;
            }

            case "stop": {
              try {
                const params = stopTrackingSchema.parse(data.params);
                const session = await handleStopTracking(params);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, session }));
              } catch (error: any) {
                log(`Error handling stop command: ${error.message}`);
                res.statusCode = 400;
                res.end(
                  JSON.stringify({ success: false, error: error.message })
                );
              }
              break;
            }

            case "status": {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  isRunning: true,
                  activeSessions: state.activeSessions,
                })
              );
              break;
            }

            case "sync": {
              try {
                const params = syncTempoSchema.parse(data.params || {});
                const result = await handleSyncTempo(params);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, result }));
              } catch (error: any) {
                log(`Error handling sync command: ${error.message}`);
                res.statusCode = 400;
                res.end(
                  JSON.stringify({ success: false, error: error.message })
                );
              }
              break;
            }

            default: {
              res.statusCode = 400;
              res.end(
                JSON.stringify({ success: false, error: "Unknown command" })
              );
            }
          }
        } catch (error: any) {
          log(`Error processing request: ${error.message}`);
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    });

    // Handle server errors
    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        log(`Port ${PORT} is already in use`);
        reject(new Error(`Port ${PORT} is already in use`));
      } else {
        log(`Server error: ${error.message}`);
        reject(error);
      }
    });

    // Start listening
    server.listen(PORT, () => {
      log(`Server listening on port ${PORT}`);
      resolve();
    });
  });
}

/**
 * Setup intervals for background tasks
 */
export function setupIntervals() {
  // Check for idle sessions
  idleCheckInterval = setInterval(() => {
    try {
      checkIdleSessions();
    } catch (error) {
      log(`Error in idle check: ${error}`);
    }
  }, IDLE_CHECK_INTERVAL_MS);

  // Send pulses
  pulseInterval = setInterval(() => {
    try {
      sendPulses();
    } catch (error) {
      log(`Error sending pulses: ${error}`);
    }
  }, PULSE_INTERVAL_MS);

  // Check for branch changes
  branchCheckInterval = setInterval(() => {
    try {
      checkBranchChanges();
    } catch (error) {
      log(`Error checking branches: ${error}`);
    }
  }, BRANCH_CHECK_INTERVAL_MS);
}

/**
 * Clean up resources when shutting down
 */
export function cleanup() {
  log("Shutting down server");

  // Clear intervals
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }

  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
  }

  if (branchCheckInterval) {
    clearInterval(branchCheckInterval);
    branchCheckInterval = null;
  }

  // Close server
  if (server) {
    server.close();
    server = null;
  }

  // Save state
  saveState();
}

/**
 * Start the backend
 */
export async function startBackend() {
  try {
    // Start the server
    await startServer();

    // Setup intervals
    setupIntervals();

    // Setup signal handlers
    process.on("SIGINT", () => {
      log("Received SIGINT");
      cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      log("Received SIGTERM");
      cleanup();
      process.exit(0);
    });

    return true;
  } catch (error) {
    log(`Error starting backend: ${error}`);
    return false;
  }
}

// Start the backend if this file is run directly
if (require.main === module) {
  startBackend();
}
