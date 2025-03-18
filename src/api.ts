import axios from "axios";
import { getApiKey } from "./auth";
import { getConfig, updateConfig } from "./config";
import inquirer from "inquirer";
import { getCurrentBranch } from "./git";

interface TempoWorklog {
  issueId: number;
  timeSpentSeconds: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  description: string;
  authorAccountId: string;
}

function toSecondsSinceMidnight(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":");
  return parseInt(hours) * 3600 + parseInt(minutes) * 60;
}

export async function createTempoWorklog(worklog: TempoWorklog) {
  const apiKey = await getApiKey();
  const config = await getConfig();

  if (!apiKey) {
    throw new Error("No API key available. Please authenticate first.");
  }

  const payload = {
    issueId: worklog.issueId,
    timeSpentSeconds: worklog.timeSpentSeconds,
    startDate: worklog.startDate,
    startTime: toSecondsSinceMidnight(worklog.startTime),
    description: worklog.description,
    authorAccountId: worklog.authorAccountId,
  };

  const response = await axios.post(
    `${config.tempoBaseUrl}/4/worklogs`,
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

// Get the current user's account ID
let cachedAccountId: string | undefined = undefined;

export async function getCurrentUser(): Promise<string> {
  if (cachedAccountId) {
    return cachedAccountId;
  }

  const apiKey = await getApiKey();
  const config = await getConfig();

  if (!apiKey) {
    throw new Error("No API key available. Please authenticate first.");
  }

  // Fallback to config or manual entry
  if (config.jiraAccountId) {
    cachedAccountId = config.jiraAccountId;
    return cachedAccountId;
  }

  const answer = await inquirer.prompt({
    type: "input",
    name: "profileUrl",
    message: `There is no Jira Account ID configured. Please paste the URL of your Jira profile page:`,
  });

  const url = new URL(answer.profileUrl);
  const parts = url.pathname.split("/");
  const accountId = parts[parts.length - 1];

  if (!accountId) {
    throw new Error("No account ID found in the provided URL.");
  }

  cachedAccountId = accountId;
  await updateConfig({ jiraAccountId: accountId });
  return accountId;
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
  issueId?: number;
  description?: string;
}): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("No API key available. Please authenticate first.");
  }

  const config = await getConfig();

  if (!config.activeTracking) {
    throw new Error("No active tracking session.");
  }

  // Prepare search strings (branch name and issue ID if available)
  const searchStrings = [config.activeTracking.branch];

  if (options.issueId) {
    searchStrings.push(`${options.issueId}`);
  }

  if (options.description) {
    searchStrings.push(options.description);
  }

  // Create the payload for the pulse API
  const payload = {
    source: "vscode",
    trigger: "save",
    timeStamp: new Date().toISOString(),
    groupId: config.activeTracking.branch,
    searchStrings,
  };

  // Note: The pulse endpoint doesn't use the /4 prefix
  const response = await axios.post(
    `${config.tempoBaseUrl.replace("/4", "")}/pulse`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}
