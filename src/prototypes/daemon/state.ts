/**
 * Tempo CLI Daemon State Management
 * 
 * Handles state persistence for the daemon process.
 * Stores tracking sessions and manages state across daemon restarts.
 */

import Conf from 'conf';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Define the schema for daemon state
const daemonStateSchema = z.object({
  activeSessions: z.array(
    z.object({
      id: z.string(),
      branch: z.string(),
      directory: z.string(),
      startTime: z.string(),
      issueId: z.number().optional(),
      description: z.string().optional(),
    })
  ).default([]),
  repositories: z.array(
    z.object({
      path: z.string(),
      name: z.string(),
      lastActive: z.string().optional(),
    })
  ).default([]),
  lastSyncTime: z.string().optional(),
});

// Type for daemon state
export type DaemonStateType = z.infer<typeof daemonStateSchema>;

// Type for active session
export type ActiveSession = DaemonStateType['activeSessions'][0];

// Type for repository info
export type RepositoryInfo = DaemonStateType['repositories'][0];

// Daemon state storage
let daemonState: Conf<DaemonStateType>;

/**
 * Initialize the daemon state
 */
export async function initDaemonState(): Promise<void> {
  daemonState = new Conf<DaemonStateType>({
    projectName: 'tempo-daemon',
    schema: {
      activeSessions: {
        type: 'array',
        default: [],
      },
      repositories: {
        type: 'array',
        default: [],
      },
      lastSyncTime: {
        type: 'string',
      },
    },
  });

  // Ensure the IPC directory exists
  const ipcDir = path.join(os.tmpdir(), 'tempo-daemon');
  if (!fs.existsSync(ipcDir)) {
    fs.mkdirSync(ipcDir, { recursive: true });
  }
}

/**
 * Get the current daemon state
 */
export async function getDaemonState(): Promise<DaemonStateType> {
  if (!daemonState) {
    await initDaemonState();
  }
  return daemonState.store;
}

/**
 * Update the daemon state
 */
export async function updateDaemonState(
  updates: Partial<DaemonStateType>
): Promise<DaemonStateType> {
  if (!daemonState) {
    await initDaemonState();
  }

  for (const [key, value] of Object.entries(updates)) {
    const stateKey = key as keyof DaemonStateType;
    if (value === undefined) {
      daemonState.delete(stateKey);
    } else {
      daemonState.set(stateKey, value);
    }
  }

  return daemonState.store;
}

/**
 * Add a new active tracking session
 */
export async function addActiveSession(
  session: Omit<ActiveSession, 'id'>
): Promise<ActiveSession> {
  const state = await getDaemonState();
  
  // Create a new session with ID
  const newSession: ActiveSession = {
    ...session,
    id: crypto.randomUUID(),
  };
  
  // Add to active sessions
  const activeSessions = [...state.activeSessions, newSession];
  await updateDaemonState({ activeSessions });
  
  // Update repositories list if needed
  await updateRepositoryList(session.directory);
  
  return newSession;
}

/**
 * Remove an active tracking session
 */
export async function removeActiveSession(id: string): Promise<void> {
  const state = await getDaemonState();
  
  // Filter out the session with the given ID
  const activeSessions = state.activeSessions.filter(session => session.id !== id);
  await updateDaemonState({ activeSessions });
}

/**
 * Find an active session by directory
 */
export async function findSessionByDirectory(directory: string): Promise<ActiveSession | undefined> {
  const state = await getDaemonState();
  return state.activeSessions.find(session => session.directory === directory);
}

/**
 * Update the repository list
 */
async function updateRepositoryList(repositoryPath: string): Promise<void> {
  const state = await getDaemonState();
  
  // Check if repository is already in the list
  const existingIndex = state.repositories.findIndex(repo => repo.path === repositoryPath);
  
  if (existingIndex >= 0) {
    // Update existing repository
    state.repositories[existingIndex].lastActive = new Date().toISOString();
  } else {
    // Add new repository
    state.repositories.push({
      path: repositoryPath,
      name: path.basename(repositoryPath),
      lastActive: new Date().toISOString(),
    });
  }
  
  await updateDaemonState({ repositories: state.repositories });
}

/**
 * Get all known repositories
 */
export async function getRepositories(): Promise<RepositoryInfo[]> {
  const state = await getDaemonState();
  return state.repositories;
}
