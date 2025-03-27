/**
 * Core tracking functionality for Tempo CLI
 *
 * Handles time tracking logic independent of any frontend
 */

import { addActivityLog, updateActivityLog } from "../config";
import type { ConfigType } from "../config";

// Define ActivityLogEntry type locally
type ActivityLogEntry = ConfigType["activityLog"][0];
import { getCurrentBranch } from "./git";
import { sendTempoPulse } from "./tempo";

// Maximum tracking time in milliseconds (8 hours)
export const MAX_TRACKING_TIME_MS = 8 * 60 * 60 * 1000;

// Pulse interval in milliseconds (5 minutes)
export const PULSE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Session interface representing an active tracking session
 */
export interface TrackingSession {
  id: string;
  branch: string;
  directory: string;
  startTime: string;
  issueId?: number;
  description?: string;
}

/**
 * Start a tracking session
 */
export async function startTracking(
  directory: string,
  options: {
    description?: string;
    issueId?: number;
  } = {}
): Promise<TrackingSession> {
  // Get the current branch
  const branch = await getCurrentBranch(directory);

  // Create a new session
  const session: TrackingSession = {
    id: crypto.randomUUID(),
    branch,
    directory,
    startTime: new Date().toISOString(),
    issueId: options.issueId,
    description: options.description,
  };

  return session;
}

/**
 * Stop a tracking session and record it in the activity log
 */
export async function stopTracking(
  session: TrackingSession
): Promise<ActivityLogEntry> {
  // Calculate duration
  const startTime = new Date(session.startTime);
  const endTime = new Date();

  // Add to activity log
  const activityEntry = await addActivityLog({
    branch: session.branch,
    directory: session.directory,
    startTime: session.startTime,
    endTime: endTime.toISOString(),
    issueId: session.issueId || 0,
    description: session.description,
  });

  return activityEntry;
}

/**
 * Send a pulse to Tempo for an active session
 */
export async function sendSessionPulse(
  session: TrackingSession,
  apiKey: string,
  tempoBaseUrl: string
): Promise<void> {
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  await sendTempoPulse({
    branch: session.branch,
    issueId: session.issueId,
    description: session.description,
    apiKey,
    tempoBaseUrl,
  });
}

/**
 * Check if a session has exceeded the maximum tracking time
 */
export function isSessionExpired(session: TrackingSession): boolean {
  const startTime = new Date(session.startTime);
  const now = new Date();
  const durationMs = now.getTime() - startTime.getTime();

  return durationMs > MAX_TRACKING_TIME_MS;
}

/**
 * Calculate the duration of a session in milliseconds
 */
export function getSessionDurationMs(
  startTime: string,
  endTime: string = new Date().toISOString()
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return end.getTime() - start.getTime();
}

/**
 * Check if the branch has changed for a session
 */
export async function hasBranchChanged(
  session: TrackingSession
): Promise<boolean> {
  try {
    const currentBranch = await getCurrentBranch(session.directory);
    return currentBranch !== session.branch;
  } catch (error) {
    // If we can't check the branch, assume it hasn't changed
    return false;
  }
}
