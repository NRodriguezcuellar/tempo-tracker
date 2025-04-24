/**
 * Shared constants for Tempo CLI
 */

// Backend server port
export const PORT = 39587; // A random port that's unlikely to be in use
export const SERVER_URL = `http://127.0.0.1:${PORT}`;
export const REQUEST_TIMEOUT_MS = 3000;

// Server constants
export const SERVER_PULSE_INTERVAL_MS = 60 * 1000; // 1 minute
export const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
export const BRANCH_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
