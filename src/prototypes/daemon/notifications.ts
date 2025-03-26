/**
 * Tempo CLI Daemon Notifications
 * 
 * Handles user notifications for the daemon process.
 * Provides desktop notifications for important events.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// Log file path
const LOG_FILE_PATH = path.join(os.tmpdir(), 'tempo-daemon', 'notifications.log');

/**
 * Write a log message to the notifications log file
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
 * Check if notifications are supported on this platform
 */
export async function areNotificationsSupported(): Promise<boolean> {
  const platform = os.platform();
  
  try {
    switch (platform) {
      case 'linux':
        // Check for notify-send (Linux)
        await execAsync('which notify-send');
        return true;
      case 'darwin':
        // Check for osascript (macOS)
        await execAsync('which osascript');
        return true;
      case 'win32':
        // Windows notifications would require a different approach
        // For prototype, we'll say it's not supported
        return false;
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Send a desktop notification
 */
export async function sendNotification(
  title: string,
  message: string,
  urgency: 'low' | 'normal' | 'critical' = 'normal'
): Promise<boolean> {
  try {
    if (!(await areNotificationsSupported())) {
      log(`Notifications not supported on this platform: ${os.platform()}`);
      return false;
    }
    
    const platform = os.platform();
    
    switch (platform) {
      case 'linux':
        // Use notify-send on Linux
        await execAsync(`notify-send --urgency=${urgency} "${title}" "${message}"`);
        break;
      case 'darwin':
        // Use osascript on macOS
        await execAsync(`osascript -e 'display notification "${message}" with title "${title}"'`);
        break;
      default:
        return false;
    }
    
    log(`Sent notification: ${title} - ${message}`);
    return true;
  } catch (error: any) {
    log(`Error sending notification: ${error.message}`);
    return false;
  }
}

/**
 * Send a notification for a long tracking session
 */
export async function notifyLongTrackingSession(
  branch: string,
  durationHours: number
): Promise<void> {
  await sendNotification(
    'Tempo Tracking Alert',
    `You've been tracking time on branch "${branch}" for ${durationHours} hours.`,
    'normal'
  );
}

/**
 * Send a notification for auto-stopped tracking
 */
export async function notifyAutoStoppedTracking(
  branch: string,
  durationHours: number
): Promise<void> {
  await sendNotification(
    'Tempo Tracking Stopped',
    `Tracking on branch "${branch}" was automatically stopped after ${durationHours} hours.`,
    'critical'
  );
}

/**
 * Send a notification for successful sync
 */
export async function notifySyncCompleted(
  count: number
): Promise<void> {
  await sendNotification(
    'Tempo Sync Completed',
    `Successfully synced ${count} tracking sessions to Tempo.`,
    'normal'
  );
}

/**
 * Send a notification for sync error
 */
export async function notifySyncError(
  error: string
): Promise<void> {
  await sendNotification(
    'Tempo Sync Error',
    `Failed to sync with Tempo: ${error}`,
    'critical'
  );
}
