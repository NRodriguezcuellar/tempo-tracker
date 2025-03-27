/**
 * Tempo API integration for Tempo CLI
 * 
 * Provides utilities for interacting with the Tempo API
 */

import axios from "axios";

/**
 * Tempo worklog interface
 */
export interface TempoWorklog {
  issueId: number;
  timeSpentSeconds: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  description: string;
  authorAccountId: string;
}

/**
 * Convert time string to seconds since midnight
 */
function toSecondsSinceMidnight(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":");
  return parseInt(hours) * 3600 + parseInt(minutes) * 60;
}

/**
 * Create a worklog in Tempo
 */
export async function createTempoWorklog(
  worklog: TempoWorklog,
  apiKey: string,
  tempoBaseUrl: string
): Promise<any> {
  if (!apiKey) throw new Error("API key not provided");

  const payload = {
    issueId: worklog.issueId,
    timeSpentSeconds: worklog.timeSpentSeconds,
    startDate: worklog.startDate,
    startTime: toSecondsSinceMidnight(worklog.startTime),
    description: worklog.description,
    authorAccountId: worklog.authorAccountId,
  };

  const response = await axios.post(
    `${tempoBaseUrl}/worklogs`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept-Version": "v4",
      },
    }
  );

  return response.data;
}

/**
 * Get worklogs for a specific date
 */
export async function getWorklogsForDate(
  date: string,
  userId: string,
  apiKey: string,
  tempoBaseUrl: string
): Promise<any[]> {
  if (!apiKey) throw new Error("API key not provided");
  if (!userId) throw new Error("User ID not provided");

  // Format date as required by Tempo API (YYYY-MM-DD)
  const formattedDate = date.split("T")[0];

  const response = await axios.get(
    `${tempoBaseUrl}/worklogs/user/${userId}`,
    {
      params: {
        from: formattedDate,
        to: formattedDate,
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Accept-Version": "v4",
      },
    }
  );

  return response.data.results || [];
}

/**
 * Send a pulse to Tempo to create a suggestion in the timesheet
 * 
 * This is an undocumented feature of the Tempo API that creates "suggestions"
 * in the Tempo timesheets without committing directly to a worklog.
 */
export async function sendTempoPulse(options: {
  branch: string;
  issueId?: number;
  description?: string;
  apiKey: string;
  tempoBaseUrl: string;
}): Promise<any> {
  if (!options.apiKey) throw new Error("API key not provided");
  if (!options.branch) throw new Error("Branch name not provided");

  // Prepare search strings (branch name and issue ID if available)
  const searchStrings = [options.branch];

  if (options.issueId) {
    searchStrings.push(`${options.issueId}`);
  }

  if (options.description) {
    searchStrings.push(options.description);
  }

  // Create the payload for the pulse API
  const payload = {
    source: "tempo-cli",
    trigger: "save",
    timeStamp: new Date().toISOString(),
    groupId: options.branch,
    searchStrings,
  };

  // Note: The pulse endpoint doesn't use the /4 prefix
  const response = await axios.post(
    `${options.tempoBaseUrl.replace("/4", "")}/pulse`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}
