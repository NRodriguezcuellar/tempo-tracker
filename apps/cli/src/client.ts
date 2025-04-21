/**
 * Client implementation for the CLI package
 *
 * Communicates with the backend server to perform operations
 */

import axios from "axios";
import { PORT, TrackingSession } from "@tempo-tracker/core";

// Backend URL
const BACKEND_URL = `http://localhost:${PORT}`;

// Define response types
interface StatusResponse {
  activeSessions: TrackingSession[];
  daemonRunning: boolean;
}

interface SyncResponse {
  synced: number;
  errors: number;
  failed: number;
}

/**
 * Start tracking on a branch
 */
export async function startTracking(options: {
  branch: string;
  directory: string;
  issueId?: number;
  description?: string;
}): Promise<TrackingSession> {
  const response = await axios.post(`${BACKEND_URL}/start`, options);
  return response.data as TrackingSession;
}

/**
 * Stop tracking on a branch
 */
export async function stopTracking(options: {
  directory: string;
}): Promise<TrackingSession> {
  const response = await axios.post(`${BACKEND_URL}/stop`, options);
  return response.data as TrackingSession;
}

/**
 * Get tracking status
 */
export async function getStatus(): Promise<StatusResponse> {
  const response = await axios.get(`${BACKEND_URL}/status`);
  return response.data as StatusResponse;
}

/**
 * Sync with Tempo
 */
export async function syncTempo(options: { date?: string }): Promise<SyncResponse> {
  const response = await axios.post(`${BACKEND_URL}/sync`, options);
  return response.data as SyncResponse;
}
