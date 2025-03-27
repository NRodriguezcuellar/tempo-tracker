/**
 * Worklog management for Tempo CLI
 *
 * Handles worklog creation and synchronization with Tempo
 */

import { getActivityLog, updateActivityLog } from "../config";
import type { ConfigType } from "../config";

// Define ActivityLogEntry type locally
type ActivityLogEntry = ConfigType["activityLog"][0];
import { createTempoWorklog, TempoWorklog } from "./tempo";
import { getSessionDurationMs } from "./tracking";

/**
 * Format a date as YYYY-MM-DD
 */
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format a time as HH:MM
 */
function formatTimeHHMM(date: Date): string {
  return date.toTimeString().substring(0, 5);
}

/**
 * Convert an activity log entry to a Tempo worklog
 */
export function activityToWorklog(
  activity: ActivityLogEntry,
  authorAccountId: string,
): TempoWorklog {
  if (!activity.endTime) {
    throw new Error("Activity must have an end time to create a worklog");
  }

  const startDate = new Date(activity.startTime);
  const endDate = new Date(activity.endTime);

  // Calculate duration in seconds
  const durationMs = getSessionDurationMs(activity.startTime, activity.endTime);
  const durationSeconds = Math.round(durationMs / 1000);

  return {
    issueId: activity.issueId,
    timeSpentSeconds: durationSeconds,
    startDate: formatDateYYYYMMDD(startDate),
    startTime: formatTimeHHMM(startDate),
    description: activity.description || `Work on branch ${activity.branch}`,
    authorAccountId,
  };
}

/**
 * Sync an activity log entry with Tempo
 */
export async function syncActivityToTempo(
  activity: ActivityLogEntry,
  authorAccountId: string,
  apiKey: string,
  tempoBaseUrl: string,
): Promise<boolean> {
  try {
    // Skip if already synced
    if (activity.synced) {
      return true;
    }

    // Convert to worklog
    const worklog = activityToWorklog(activity, authorAccountId);

    // Create worklog in Tempo
    await createTempoWorklog(worklog, apiKey, tempoBaseUrl);

    // Mark as synced
    await updateActivityLog(activity.id, { synced: true });

    return true;
  } catch (error) {
    console.error(`Failed to sync activity ${activity.id}:`, error);
    return false;
  }
}

/**
 * Sync all unsynced activities for a specific date
 */
export async function syncActivitiesForDate(
  date: string,
  authorAccountId: string,
  apiKey: string,
  tempoBaseUrl: string,
): Promise<{ synced: number; failed: number }> {
  const activities = await getActivityLog();

  // Filter activities for the specified date
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);

  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const activitiesForDate = activities.filter((activity) => {
    const activityDate = new Date(activity.startTime);
    return activityDate >= dateStart && activityDate <= dateEnd;
  });

  // Sync each activity
  let synced = 0;
  let failed = 0;

  for (const activity of activitiesForDate) {
    if (!activity.synced) {
      const success = await syncActivityToTempo(
        activity,
        authorAccountId,
        apiKey,
        tempoBaseUrl,
      );

      if (success) {
        synced++;
      } else {
        failed++;
      }
    }
  }

  return { synced, failed };
}
