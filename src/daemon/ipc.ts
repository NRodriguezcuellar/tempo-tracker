/**
 * Tempo CLI Daemon IPC
 *
 * Handles inter-process communication between the CLI and daemon.
 * Uses named pipes (Unix sockets) for local communication.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { EventEmitter } from "events";
import { z } from "zod";
import { ActiveSession, getDaemonState, updateDaemonState } from "./state";
import { startTrackingSession, stopTrackingSession } from "./daemon-process";

// IPC socket path
const IPC_SOCKET_DIR = path.join(os.tmpdir(), "tempo-daemon");
const IPC_SOCKET_PATH = path.join(IPC_SOCKET_DIR, "ipc.sock");

// Message types
export enum MessageType {
  START_TRACKING = "start-tracking",
  STOP_TRACKING = "stop-tracking",
  GET_STATUS = "get-status",
  SYNC_TEMPO = "sync-tempo",
  RESPONSE = "response",
  ERROR = "error",
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
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function }
  > = new Map();
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
      // Send a ping message to check if the daemon is responsive
      const pingFile = `${this.socketPath}.ping`;
      const pingId = Date.now().toString();
      fs.writeFileSync(pingFile, pingId);

      // Wait for a short time to see if the daemon removes the ping file
      // This indicates the daemon is actively monitoring the socket directory
      await new Promise((resolve) => setTimeout(resolve, 500));

      const pingExists = fs.existsSync(pingFile);
      if (pingExists) {
        // Clean up the ping file if it still exists (daemon didn't remove it)
        try {
          fs.unlinkSync(pingFile);
        } catch (e) {
          /* ignore */
        }
        return false;
      }

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
      reject(new Error("Connection closed"));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Send a message to the daemon
   */
  private async sendMessage(message: Message): Promise<Message> {
    if (!this.connected) {
      throw new Error("Not connected to daemon");
    }

    return new Promise((resolve, reject) => {
      // Store the promise callbacks
      this.pendingRequests.set(message.id, { resolve, reject });

      // Set a timeout to reject the promise if no response is received
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error("Request timed out"));
        }
      }, 5000); // 5 second timeout

      try {
        // Write the message to a temporary file next to the socket
        const messageFile = `${this.socketPath}.${message.id}.request`;
        fs.writeFileSync(messageFile, this.serializeMessage(message));

        // Set up an interval to check for the response
        const checkInterval = setInterval(() => {
          const responseFile = `${this.socketPath}.${message.id}.response`;

          if (fs.existsSync(responseFile)) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);

            try {
              // Read the response
              const responseData = fs.readFileSync(responseFile, "utf8");

              // Clean up files
              try {
                fs.unlinkSync(responseFile);
              } catch (e) {
                /* ignore */
              }

              // Parse and handle the response
              const response = this.parseMessage(responseData);
              this.handleMessage(response);
            } catch (err: any) {
              // If there's an error reading the response, reject the promise
              this.pendingRequests.delete(message.id);
              reject(new Error(`Failed to read response: ${err.message}`));
            }
          }
        }, 100); // Check every 100ms

        // Clean up the interval if the socket becomes unavailable
        const socketCheckInterval = setInterval(() => {
          if (!fs.existsSync(this.socketPath)) {
            clearInterval(checkInterval);
            clearInterval(socketCheckInterval);
            clearTimeout(timeoutId);
            this.connected = false;
            reject(new Error("Lost connection to daemon"));
          }
        }, 1000); // Check every second

        // Clean up the socket check interval after timeout
        setTimeout(() => {
          clearInterval(socketCheckInterval);
        }, 5000);
      } catch (err: any) {
        // If there's an error writing the message, reject the promise
        clearTimeout(timeoutId);
        this.pendingRequests.delete(message.id);
        reject(new Error(`Failed to send message: ${err.message}`));
      }
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
    const response = (await this.sendMessage(message)) as ResponseMessage;

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
  private messageCheckInterval: NodeJS.Timeout | null = null;

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

    // Clean up any old message files
    this.cleanupMessageFiles();

    // Create a simple file to indicate the socket is available
    // This is a workaround for the simulated IPC
    fs.writeFileSync(this.socketPath, "TEMPO_DAEMON_SOCKET");

    // Start checking for incoming messages
    this.startMessageChecking();

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

    // Stop checking for messages
    this.stopMessageChecking();

    // Remove the socket file
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    // Clean up any message files
    this.cleanupMessageFiles();

    this.isRunning = false;

    console.log("IPC server stopped");
  }

  /**
   * Start checking for incoming messages
   */
  private startMessageChecking(): void {
    if (this.messageCheckInterval) {
      return;
    }

    // Check for messages every 100ms
    this.messageCheckInterval = setInterval(() => {
      this.checkForMessages();
    }, 100);
  }

  /**
   * Stop checking for incoming messages
   */
  private stopMessageChecking(): void {
    if (this.messageCheckInterval) {
      clearInterval(this.messageCheckInterval);
      this.messageCheckInterval = null;
    }
  }

  /**
   * Clean up any message files
   */
  private cleanupMessageFiles(): void {
    // Get all files in the socket directory
    const socketDir = path.dirname(this.socketPath);
    if (fs.existsSync(socketDir)) {
      const files = fs.readdirSync(socketDir);
      for (const file of files) {
        // Check if it's a message file for our socket
        if (
          file.startsWith(path.basename(this.socketPath) + ".") &&
          (file.endsWith(".request") || file.endsWith(".response"))
        ) {
          try {
            fs.unlinkSync(path.join(socketDir, file));
          } catch (error) {
            // Ignore errors
          }
        }
      }
    }
  }

  /**
   * Check for incoming messages
   */
  private async checkForMessages(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get all files in the socket directory
      const socketDir = path.dirname(this.socketPath);
      const files = fs.readdirSync(socketDir);

      // Process each file in the directory
      for (const file of files) {
        const fullPath = path.join(socketDir, file);

        // Handle ping files (for connection testing)
        if (file.startsWith(path.basename(this.socketPath) + ".ping")) {
          try {
            // Just delete the ping file to indicate the daemon is responsive
            fs.unlinkSync(fullPath);
          } catch (error) {
            // Ignore errors
          }
          continue;
        }

        // Handle request files
        if (
          file.startsWith(path.basename(this.socketPath) + ".") &&
          file.endsWith(".request")
        ) {
          try {
            // Read the message
            const messageData = fs.readFileSync(fullPath, "utf8");
            const message = this.parseMessage(messageData);

            // Process the message
            const response = await this.processMessage(message);

            // Write the response
            const responseFile = fullPath.replace(".request", ".response");
            fs.writeFileSync(responseFile, this.serializeMessage(response));

            // Delete the request file after processing
            try {
              fs.unlinkSync(fullPath);
            } catch (error) {
              // Ignore errors
            }
          } catch (error: any) {
            // Log errors and continue processing other messages
            console.error(`Error processing message: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      // Ignore errors during file checking
    }
  }

  /**
   * Process an incoming message
   */
  private async processMessage(message: Message): Promise<Message> {
    console.log(`Processing message: ${message.type}`);
    try {
      let response: Message;
      switch (message.type) {
        case MessageType.START_TRACKING:
          response = await this.handleStartTracking(
            message as StartTrackingMessage
          );
          break;
        case MessageType.STOP_TRACKING:
          response = await this.handleStopTracking(
            message as StopTrackingMessage
          );
          break;
        case MessageType.GET_STATUS:
          response = await this.handleGetStatus(message as GetStatusMessage);
          break;
        case MessageType.SYNC_TEMPO:
          response = await this.handleSyncTempo(message as SyncTempoMessage);
          break;
        default:
          response = this.createMessage(
            MessageType.ERROR,
            null,
            `Unknown message type: ${message.type}`
          );
      }
      console.log(`Response for ${message.type}:`, response);
      return response;
    } catch (error: any) {
      console.error(`Error processing ${message.type}:`, error);
      return this.createMessage(MessageType.ERROR, null, error.message);
    }
  }

  /**
   * Handle a start tracking message
   */
  private async handleStartTracking(
    message: StartTrackingMessage
  ): Promise<Message> {
    try {
      const { directory, branch, issueId, description } = message.data;
      await startTrackingSession(directory, branch, issueId, description);
      const state = await getDaemonState();
      return this.createMessage(MessageType.RESPONSE, {
        success: true,
        activeSessions: state.activeSessions,
      });
    } catch (error: any) {
      return this.createMessage(MessageType.ERROR, null, error.message);
    }
  }

  /**
   * Handle a stop tracking message
   */
  private async handleStopTracking(
    message: StopTrackingMessage
  ): Promise<Message> {
    try {
      const { directory } = message.data;
      const state = await getDaemonState();
      const session = state.activeSessions.find(
        (s) => s.directory === directory
      );
      if (!session) {
        throw new Error(
          `No active tracking session found for directory: ${directory}`
        );
      }
      await stopTrackingSession(session.id);
      return this.createMessage(MessageType.RESPONSE, {
        success: true,
      });
    } catch (error: any) {
      return this.createMessage(MessageType.ERROR, null, error.message);
    }
  }

  /**
   * Handle a get status message
   */
  private async handleGetStatus(message: GetStatusMessage): Promise<Message> {
    try {
      const state = await getDaemonState();
      return this.createMessage(MessageType.RESPONSE, {
        isRunning: true,
        activeSessions: state.activeSessions,
      });
    } catch (error: any) {
      return this.createMessage(MessageType.ERROR, null, error.message);
    }
  }

  /**
   * Handle a sync tempo message
   */
  private async handleSyncTempo(message: SyncTempoMessage): Promise<Message> {
    try {
      const { date } = message.data;
      const state = await getDaemonState();

      // For now, just return success since we haven't implemented Tempo sync yet
      return this.createMessage(MessageType.RESPONSE, {
        success: true,
        message: "Sync with Tempo not yet implemented",
      });
    } catch (error: any) {
      return this.createMessage(MessageType.ERROR, null, error.message);
    }
  }
}
