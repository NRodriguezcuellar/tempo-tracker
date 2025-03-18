import axios from "axios";
import { getApiKey } from "./auth";
import { getConfig } from "./config";

interface TempoWorklog {
  issueKey: string;
  timeSpentSeconds: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  description: string;
}

export async function createTempoWorklog(worklog: TempoWorklog) {
  const apiKey = await getApiKey();
  const config = await getConfig();

  if (!apiKey) {
    throw new Error("No API key available. Please authenticate first.");
  }

  const response = await axios.post(
    `${config.tempoBaseUrl}/worklogs`,
    {
      issueKey: worklog.issueKey,
      timeSpentSeconds: worklog.timeSpentSeconds,
      startDate: worklog.startDate,
      startTime: worklog.startTime,
      description: worklog.description,
      authorAccountId: await getCurrentUser(),
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept-Version': 'v4'
      },
    }
  );

  return response.data;
}

// Get the current user's account ID
let cachedAccountId: string | null = null;

export async function getCurrentUser(): Promise<string | null> {
  if (cachedAccountId) {
    return cachedAccountId;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("No API key available. Please authenticate first.");
  }

  // Get current user info from Jira
  const config = await getConfig();
  const response = await axios.get(`${config.jiraInstance}/rest/api/3/myself`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  cachedAccountId = response.data.accountId;
  return cachedAccountId;
}

export async function getWorklogsForDate(date: string): Promise<any[]> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("No API key available. Please authenticate first.");
  }

  const userId = await getCurrentUser();
  const config = await getConfig();

  // Format date as required by Tempo API (YYYY-MM-DD)
  const formattedDate = date.split("T")[0];

  const response = await axios.get(
    `${config.tempoBaseUrl}/worklogs/user/${userId}`,
    {
      params: {
        from: formattedDate,
        to: formattedDate,
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Accept-Version': 'v4'
      },
    }
  );

  return response.data.results || [];
}
