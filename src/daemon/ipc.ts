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
      // For now, we'll simulate the connection
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

    this.connected = false;
    this.socket = null;

    // Clear any pending requests
    for (const [id, { reject }] of this.pendingRequests.entries()) {
      reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Send a message to the daemon
   */
  private async sendMessage(message: Message): Promise<Message> {
    if (!this.connected) {
      throw new Error('Not connected to daemon');
    }

    return new Promise((resolve, reject) => {
      // Store the promise callbacks
      this.pendingRequests.set(message.id, { resolve, reject });

      // Set a timeout to reject the promise if no response is received
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error('Request timed out'));
        }
      }, 5000);

      // In a real implementation, this would send the message over the socket
      // For now, we'll simulate the response
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          const response = this.createMessage(MessageType.RESPONSE, { success: true });
          this.handleMessage(response);
        }
      }, 100);
    });
  }

  /**
   * Handle a message from the daemon
   */
  private handleMessage(message: Message): void {
    // Check if this is a response to a pending request
    if (this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      resolve(message);
      return;
    }

    // Emit the message as an event
    this.emit(message.type, message);
  }

  /**
   * Start tracking in a directory
   */
  async startTracking(
    directory: string,
    branch: string,
    issueId?: number,
    description?: string
  ): Promise<void> {
    const message = this.createMessage(MessageType.START_TRACKING, {
      directory,
      branch,
      issueId,
      description,
    });

    await this.sendMessage(message);
  }

  /**
   * Stop tracking in a directory
   */
  async stopTracking(directory: string): Promise<void> {
    const message = this.createMessage(MessageType.STOP_TRACKING, {
      directory,
    });

    await this.sendMessage(message);
  }

  /**
   * Get daemon status
   */
  async getStatus(): Promise<StatusResponse> {
    const message = this.createMessage(MessageType.GET_STATUS);
    const response = await this.sendMessage(message) as ResponseMessage;

    return response.data as StatusResponse;
  }

  /**
   * Sync with Tempo
   */
  async syncTempo(date?: string): Promise<void> {
    const message = this.createMessage(MessageType.SYNC_TEMPO, {
      date,
    });

    await this.sendMessage(message);
  }
}

/**
 * Server-side IPC implementation
 * Used by the daemon to listen for messages from the CLI
 */
export class IPCServer extends BaseIPC {
  private isRunning: boolean = false;

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // Ensure the socket directory exists
    if (!fs.existsSync(path.dirname(this.socketPath))) {
      fs.mkdirSync(path.dirname(this.socketPath), { recursive: true });
    }

    // Remove the socket file if it already exists
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    // Create a simple file to indicate the socket is available
    // This is a workaround for the simulated IPC
    fs.writeFileSync(this.socketPath, 'TEMPO_DAEMON_SOCKET');

    this.isRunning = true;

    console.log(`IPC server started on ${this.socketPath}`);
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Remove the socket file
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    this.isRunning = false;

    console.log('IPC server stopped');
  }
}
