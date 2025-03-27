/**
 * Tempo CLI Daemon Server
 *
 * A lightweight HTTP server that handles communication between
 * the CLI client and the daemon process.
 */

import http from "http";
import { z } from "zod";
import { getConfig } from "../config";
import { sendTempoPulseDirect } from "../api";
import path from "path";
import fs from "fs";
import os from "os";

// Constants
const PORT = 39587; // A random port that's unlikely to be in use
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const PULSE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRACKING_TIME_MS = 8 * 60 * 60 * 1000; // 8 hours
const LOG_DIR = path.join(os.tmpdir(), "tempo-daemon");
const LOG_FILE = path.join(LOG_DIR, "daemon.log");
const PID_FILE = path.join(LOG_DIR, "daemon.pid");

// State
interface Session {
  id: string;
  branch: string;
  directory: string;
  startTime: string;
  issueId?: number;
  description?: string;
}

interface DaemonState {
  activeSessions: Session[];
}

let state: DaemonState = {
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

/**
 * Initialize the log directory and file
 */
function initLogging() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  log("Tempo daemon starting");
}

/**
 * Write to the log file
 */
function log(message: string) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;

  fs.appendFileSync(LOG_FILE, entry);
}

/**
 * Write the PID file
 */
function writePidFile() {
  fs.writeFileSync(PID_FILE, process.pid.toString());
  log(`PID file written: ${process.pid}`);
}

/**
 * Load state from disk
 */
function loadState() {
  const statePath = path.join(LOG_DIR, "state.json");

  try {
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, "utf8");
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
  const statePath = path.join(LOG_DIR, "state.json");

  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    log("State saved");
  } catch (error) {
    log(`Error saving state: ${error}`);
  }
}

/**
 * Start a tracking session
 */
async function startTracking(
  params: z.infer<typeof startTrackingSchema>
): Promise<Session> {
  // Check if already tracking in this directory
  const existingIndex = state.activeSessions.findIndex(
    (session) => session.directory === params.directory
  );

  // If already tracking, stop the previous session
  if (existingIndex !== -1) {
    const session = state.activeSessions[existingIndex];
    log(`Replacing existing session in ${params.directory}`);
    state.activeSessions.splice(existingIndex, 1);
  }

  // Create new session
  const session: Session = {
    id: crypto.randomUUID(),
    branch: params.branch,
    directory: params.directory,
    startTime: new Date().toISOString(),
    issueId: params.issueId,
    description: params.description,
  };

  // Add to active sessions
  state.activeSessions.push(session);
  log(`Started tracking in ${params.directory} on branch ${params.branch}`);

  // Save state
  saveState();

  try {
    const config = await getConfig();
    if (config.apiKey) {
      await sendTempoPulseDirect({
        branch: session.branch,
        issueId: session.issueId,
        description: session.description,
        apiKey: config.apiKey,
        tempoBaseUrl: config.tempoBaseUrl,
      });
      log(`Sent initial pulse for session ${session.id}`);
    }
  } catch (error) {
    log(`Error sending initial pulse for session ${session.id}: ${error}`);
    // Continue even if pulse fails
  }

  return session;
}

/**
 * Stop a tracking session
 */
function stopTracking(
  params: z.infer<typeof stopTrackingSchema>
): Session | null {
  // Find the session for this directory
  const index = state.activeSessions.findIndex(
    (session) => session.directory === params.directory
  );

  if (index === -1) {
    log(`No active session found for ${params.directory}`);
    return null;
  }

  // Remove from active sessions
  const session = state.activeSessions[index];
  state.activeSessions.splice(index, 1);

  log(`Stopped tracking in ${params.directory}`);

  // Save state
  saveState();

  return session;
}

/**
 * Check for idle sessions
 */
function checkIdleSessions() {
  const now = new Date();

  for (let i = state.activeSessions.length - 1; i >= 0; i--) {
    const session = state.activeSessions[i];
    const startTime = new Date(session.startTime);
    const duration = now.getTime() - startTime.getTime();

    if (duration > MAX_TRACKING_TIME_MS) {
      log(`Session ${session.id} exceeded max duration, auto-stopping`);
      state.activeSessions.splice(i, 1);
      saveState();
    }
  }
}

/**
 * Send pulses for active sessions
 */
async function sendPulses() {
  const config = await getConfig();

  if (!config.apiKey) {
    log("API key not configured, skipping pulse sending");
    return;
  }

  log(`Sending pulses for ${state.activeSessions.length} sessions`);

  for (const session of state.activeSessions) {
    try {
      await sendTempoPulseDirect({
        branch: session.branch,
        issueId: session.issueId,
        description: session.description,
        apiKey: config.apiKey,
        tempoBaseUrl: config.tempoBaseUrl,
      });

      log(`Sent pulse for session ${session.id}`);
    } catch (error) {
      log(`Error sending pulse for session ${session.id}: ${error}`);
    }
  }
}

/**
 * Start the server
 */
function startServer() {
  server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    // Read request body
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        // Parse the JSON body
        const data = JSON.parse(body);

        // Handle the command
        if (!data.command) {
          throw new Error("Missing command field");
        }

        let result: any;

        switch (data.command) {
          case "start":
            const startParams = startTrackingSchema.parse(data.params);
            result = await startTracking(startParams);
            break;

          case "stop":
            const stopParams = stopTrackingSchema.parse(data.params);
            result = stopTracking(stopParams);
            break;

          case "status":
            result = {
              isRunning: true,
              activeSessions: state.activeSessions,
            };
            break;

          case "sync":
            // TODO: Implement sync
            result = { synced: true };
            break;

          default:
            throw new Error(`Unknown command: ${data.command}`);
        }

        // Send response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, result }));
      } catch (error) {
        log(`Error handling request: ${error}`);

        // Send error response
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  });

  server.listen(PORT, "127.0.0.1", () => {
    log(`Server listening on http://127.0.0.1:${PORT}`);
  });

  // Handle server errors
  server.on("error", (error) => {
    log(`Server error: ${error}`);

    if ((error as any).code === "EADDRINUSE") {
      log("Port already in use, daemon may already be running");
      process.exit(1);
    }
  });
}

/**
 * Setup intervals for background tasks
 */
function setupIntervals() {
  // Check for idle sessions every minute
  idleCheckInterval = setInterval(checkIdleSessions, IDLE_CHECK_INTERVAL_MS);
  log("Idle checking interval started");

  // Send pulses every 5 minutes
  pulseInterval = setInterval(sendPulses, PULSE_INTERVAL_MS);
  log("Pulse sending interval started");
}

/**
 * Clean up resources when shutting down
 */
function cleanup() {
  log("Shutting down daemon...");

  // Clear intervals
  if (idleCheckInterval) clearInterval(idleCheckInterval);
  if (pulseInterval) clearInterval(pulseInterval);

  // Close server
  if (server) server.close();

  // Save state one last time
  saveState();

  // Remove PID file
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }

  log("Daemon shutdown complete");
}

/**
 * Main function to start the daemon
 */
function startDaemon() {
  // Initialize logging
  initLogging();

  // Write PID file
  writePidFile();

  // Load saved state
  loadState();

  // Start HTTP server
  startServer();

  // Setup intervals
  setupIntervals();

  // Register cleanup handlers
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);

  log("Daemon started successfully");
}

// Start the daemon if this file is run directly
if (require.main === module) {
  startDaemon();
}

// Export functions for testing and CLI integration
export { startDaemon, startTracking, stopTracking };
