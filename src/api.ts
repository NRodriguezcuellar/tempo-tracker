import axios from "axios";
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
  const config = await getConfig();
  if (!config.apiKey) throw new Error("API key not configured");

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
        Authorization: `Bearer ${config.apiKey}`,
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

  const config = await getConfig();
  if (!config.apiKey) throw new Error("API key not configured");

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
  const config = await getConfig();
  if (!config.apiKey) throw new Error("API key not configured");

  const userId = await getCurrentUser();

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
        Authorization: `Bearer ${config.apiKey}`,
        "Accept-Version": "v4",
      },
    }
  );

  return response.data.results || [];
}

/**
 * Send a pulse to Tempo to create a suggestion in the timesheet using direct tracking information
 *
 * This is an undocumented feature of the Tempo API that creates "suggestions"
 * in the Tempo timesheets without committing directly to a worklog.
 */
export async function sendTempoPulseDirect(options: {
  branch: string;
  issueId?: number;
  description?: string;
  apiKey: string;
  tempoBaseUrl: string;
}): Promise<void> {
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
    source: "vscode",
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

/**
 * Send a pulse to Tempo to create a suggestion in the timesheet
 *
 * This is an undocumented feature of the Tempo API that creates "suggestions"
 * in the Tempo timesheets without committing directly to a worklog.
 *
 * @deprecated Use sendTempoPulseDirect instead which doesn't rely on global config
 */
export async function sendTempoPulse(options: {
  issueId?: number;
  description?: string;
}): Promise<void> {
  const config = await getConfig();
  if (!config.apiKey) throw new Error("API key not configured");

  if (!config.activeTracking) {
    throw new Error("No active tracking session.");
  }

  return sendTempoPulseDirect({
    branch: config.activeTracking.branch,
    issueId: options.issueId,
    description: options.description,
    apiKey: config.apiKey,
    tempoBaseUrl: config.tempoBaseUrl,
  });
}
