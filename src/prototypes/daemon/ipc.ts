/**
 * Tempo CLI Daemon IPC
 * 
 * Handles inter-process communication between the CLI and daemon.
 * Uses named pipes (Unix sockets) for local communication.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { ActiveSession } from './state';

// IPC socket path
const IPC_SOCKET_DIR = path.join(os.tmpdir(), 'tempo-daemon');
const IPC_SOCKET_PATH = path.join(IPC_SOCKET_DIR, 'ipc.sock');

// Message types
export enum MessageType {
  START_TRACKING = 'start-tracking',
  STOP_TRACKING = 'stop-tracking',
  GET_STATUS = 'get-status',
  SYNC_TEMPO = 'sync-tempo',
  RESPONSE = 'response',
  ERROR = 'error',
}

// Message schemas
const baseMessageSchema = z.object({
  type: z.nativeEnum(MessageType),
  id: z.string(),
  timestamp: z.string(),
});

const startTrackingMessageSchema = baseMessageSchema.extend({
  type: z.literal(MessageType.START_TRACKING),
  data: z.object({
    branch: z.string(),
    directory: z.string(),
    issueId: z.number().optional(),
    description: z.string().optional(),
  }),
});

const stopTrackingMessageSchema = baseMessageSchema.extend({
  type: z.literal(MessageType.STOP_TRACKING),
  data: z.object({
    directory: z.string(),
  }),
});

const getStatusMessageSchema = baseMessageSchema.extend({
  type: z.literal(MessageType.GET_STATUS),
});

const syncTempoMessageSchema = baseMessageSchema.extend({
  type: z.literal(MessageType.SYNC_TEMPO),
  data: z.object({
    date: z.string().optional(),
  }),
});

const responseMessageSchema = baseMessageSchema.extend({
  type: z.literal(MessageType.RESPONSE),
  data: z.any(),
});

const errorMessageSchema = baseMessageSchema.extend({
  type: z.literal(MessageType.ERROR),
  error: z.string(),
});

// Union of all message types
const messageSchema = z.union([
  startTrackingMessageSchema,
  stopTrackingMessageSchema,
  getStatusMessageSchema,
  syncTempoMessageSchema,
  responseMessageSchema,
  errorMessageSchema,
]);

// Message types
export type Message = z.infer<typeof messageSchema>;
export type StartTrackingMessage = z.infer<typeof startTrackingMessageSchema>;
export type StopTrackingMessage = z.infer<typeof stopTrackingMessageSchema>;
export type GetStatusMessage = z.infer<typeof getStatusMessageSchema>;
export type SyncTempoMessage = z.infer<typeof syncTempoMessageSchema>;
export type ResponseMessage = z.infer<typeof responseMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;

/**
 * Base IPC class with common functionality
 */
export abstract class BaseIPC extends EventEmitter {
  protected socketPath: string;

  constructor() {
    super();
    this.socketPath = IPC_SOCKET_PATH;
    
    // Ensure socket directory exists
    if (!fs.existsSync(path.dirname(this.socketPath))) {
      fs.mkdirSync(path.dirname(this.socketPath), { recursive: true });
    }
  }

  /**
   * Create a new message
   */
  protected createMessage<T extends MessageType>(
    type: T,
    data?: any,
    error?: string
  ): Message {
    const message: any = {
      type,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    if (data !== undefined) {
      message.data = data;
    }

    if (error !== undefined) {
      message.error = error;
    }

    return message as Message;
  }

  /**
   * Parse a message from JSON
   */
  protected parseMessage(json: string): Message {
    try {
      const data = JSON.parse(json);
      return messageSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid message format: ${error}`);
    }
  }

  /**
   * Serialize a message to JSON
   */
  protected serializeMessage(message: Message): string {
    return JSON.stringify(message);
  }
}

/**
 * Status response type
 */
export interface StatusResponse {
  isRunning: boolean;
  activeSessions: ActiveSession[];
}

/**
 * Client-side IPC implementation
 * Used by the CLI to communicate with the daemon
 */
export class IPCClient extends BaseIPC {
  private connected: boolean = false;
  private socket: any = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * Connect to the daemon
   */
  async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }

    // Check if socket exists
    if (!fs.existsSync(this.socketPath)) {
      return false;
    }

    try {
      // In a real implementation, this would use a proper IPC mechanism
      // For the prototype, we'll simulate the connection
      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from the daemon
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      // Clean up resources
      if (this.socket) {
        this.socket = null;
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.connected = false;
    } catch (error) {
      // Ignore errors during disconnect
    }
  }

  /**
   * Send a message to the daemon and wait for response
   */
  async sendMessage<T>(message: Message): Promise<T> {
    if (!this.connected && !(await this.connect())) {
      throw new Error('Daemon is not running');
    }

    return new Promise<T>((resolve, reject) => {
      // In a real implementation, this would send the message over the socket
      // For the prototype, we'll simulate the response
      
      // Store the pending request
      this.pendingRequests.set(message.id, { resolve, reject });
      
      // Simulate response after a short delay
      setTimeout(() => {
        // Remove the pending request
        this.pendingRequests.delete(message.id);
        
        // Resolve with a simulated response
        resolve({} as T);
      }, 100);
    });
  }

  /**
   * Start tracking in a directory
   */
  async startTracking(
    directory: string,
    branch: string,
    issueId?: number,
    description?: string
  ): Promise<ActiveSession> {
    const message = this.createMessage(MessageType.START_TRACKING, {
      directory,
      branch,
      issueId,
      description,
    });

    return this.sendMessage<ActiveSession>(message);
  }

  /**
   * Stop tracking in a directory
   */
  async stopTracking(directory: string): Promise<void> {
    const message = this.createMessage(MessageType.STOP_TRACKING, {
      directory,
    });

    return this.sendMessage<void>(message);
  }

  /**
   * Get daemon status
   */
  async getStatus(): Promise<StatusResponse> {
    const message = this.createMessage(MessageType.GET_STATUS);
    return this.sendMessage<StatusResponse>(message);
  }

  /**
   * Sync with Tempo
   */
  async syncTempo(date?: string): Promise<void> {
    const message = this.createMessage(MessageType.SYNC_TEMPO, {
      date,
    });

    return this.sendMessage<void>(message);
  }
}
