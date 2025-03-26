import { getCurrentBranch, findGitRoot } from "./git";
import {
  getConfig,
  updateConfig,
  addActivityLog,
  updateActivityLog,
  getActivityLog,
  ConfigType,
  clearActivityLog,
} from "./config";
import chalk from "chalk";
import { createTempoWorklog, sendTempoPulse } from "./api";
import inquirer from "inquirer";
import { formatDate, formatDuration } from "./utils/format";
import { startDaemon, stopDaemon, statusDaemon } from "./daemon/service";
import { startTrackingViaDaemon, stopTrackingViaDaemon } from "./daemon/ipc-client";

// Store active check interval
let activeCheckInterval: any = null;

// Store pulse interval
let activePulseInterval: any = null;

// Maximum tracking time in milliseconds (8 hours)
const MAX_TRACKING_TIME_MS = 8 * 60 * 60 * 1000;

// Pulse interval in milliseconds (5 minutes)
const PULSE_INTERVAL_MS = 5 * 60 * 1000;

export async function startTracking(options: {
  description?: string;
  issueId: number;
}) {
  // Get the current working directory
  const cwd = process.cwd();

  // Check if we're in a git repository
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error(
      "Not in a git repository. Please navigate to a git repository to start tracking."
    );
  }

  // Check if there's already an active tracking session
  const config = await getConfig();
  if (config.activeTracking) {
    console.log(chalk.yellow("There is already an active tracking session:"));
    console.log(`  Branch: ${chalk.cyan(config.activeTracking.branch)}`);
    console.log(
      `  Started: ${chalk.cyan(
        new Date(config.activeTracking.startTime).toLocaleString()
      )}`
    );
    console.log(`  Directory: ${chalk.cyan(config.activeTracking.directory)}`);

    const { shouldContinue } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldContinue",
        message: "Do you want to stop the current session and start a new one?",
        default: false,
      },
    ]);

    if (shouldContinue) {
      await stopTracking();
    } else {
      return;
    }
  }

  // Get the current branch
  const branch = await getCurrentBranch(gitRoot);

  // Start tracking
  const startTime = new Date().toISOString();
  await updateConfig({
    activeTracking: {
      branch,
      directory: gitRoot,
      startTime,
      issueId: options.issueId,
      description: options.description,
    },
  });

  console.log(
    chalk.green("✓ Started tracking time on branch:"),
    chalk.cyan(branch)
  );
  if (options.issueId) {
    console.log(`  Issue: ${chalk.cyan(options.issueId)}`);
  }
  if (options.description) {
    console.log(`  Description: ${chalk.cyan(options.description)}`);
  }

  // Start the branch check interval
  startBranchChecks();

  // Start sending pulses
  startPulseSending();

  // Set auto-stop after 8 hours
  scheduleAutoStop();
}

export async function stopTracking() {
  // Get the current config
  const config = await getConfig();

  if (!config.activeTracking) {
    console.log(chalk.yellow("No active tracking session."));
    return;
  }

  // Calculate the duration
  const startTime = new Date(config.activeTracking.startTime);
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  // Add to activity log
  await addActivityLog({
    branch: config.activeTracking.branch,
    directory: config.activeTracking.directory,
    startTime: config.activeTracking.startTime,
    endTime: endTime.toISOString(),
    issueId: config.activeTracking.issueId,
    description: config.activeTracking.description,
  });

  // Clear active tracking
  await updateConfig({ activeTracking: undefined });

  // Stop the branch check interval
  stopBranchChecks();

  // Stop sending pulses
  stopPulseSending();

  // Cancel auto-stop timer
  cancelAutoStop();

  console.log(chalk.green("✓ Stopped tracking time."));
  console.log(`  Branch: ${chalk.cyan(config.activeTracking.branch)}`);
  console.log(`  Duration: ${chalk.cyan(`${durationMinutes} minutes`)}`);
  console.log(`  Activity saved and ready to sync with Tempo.`);
}

export async function statusTracking() {
  // Get the current config
  const config = await getConfig();

  if (!config.activeTracking) {
    console.log(chalk.yellow("No active tracking session."));

    // Show summary of today's tracked time
    const activityLog = await getActivityLog();
    const today = new Date().toISOString().split("T")[0];

    const todayActivities = activityLog.filter((activity) =>
      activity.startTime.startsWith(today)
    );

    if (todayActivities.length > 0) {
      console.log(chalk.blue("\nToday's tracked time:"));

      let totalMinutes = 0;
      const branchSummary: Record<string, number> = {};

      for (const activity of todayActivities) {
        const startTime = new Date(activity.startTime);
        const endTime = activity.endTime
          ? new Date(activity.endTime)
          : new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        totalMinutes += durationMinutes;

        if (!branchSummary[activity.branch]) {
          branchSummary[activity.branch] = 0;
        }
        branchSummary[activity.branch] += durationMinutes;
      }

      // Display branch summary
      for (const [branch, minutes] of Object.entries(branchSummary)) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        console.log(`  ${chalk.cyan(branch)}: ${hours}h ${remainingMinutes}m`);
      }

      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      console.log(chalk.blue(`\nTotal: ${totalHours}h ${remainingMinutes}m`));
    }

    return;
  }

  // Calculate current duration
  const startTime = new Date(config.activeTracking.startTime);
  const now = new Date();
  const durationMs = now.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  console.log(chalk.green("Active tracking session:"));
  console.log(`  Branch: ${chalk.cyan(config.activeTracking.branch)}`);
  console.log(`  Started: ${chalk.cyan(startTime.toLocaleString())}`);
  console.log(`  Duration: ${chalk.cyan(`${hours}h ${minutes}m`)}`);

  if (config.activeTracking.issueId) {
    console.log(`  Issue: ${chalk.cyan(config.activeTracking.issueId)}`);
  }

  if (config.activeTracking.description) {
    console.log(
      `  Description: ${chalk.cyan(config.activeTracking.description)}`
    );
  }

  // Check if we're still on the same branch
  const cwd = process.cwd();
  const gitRoot = findGitRoot(cwd);

  if (gitRoot) {
    try {
      const currentBranch = await getCurrentBranch(gitRoot);
      if (currentBranch !== config.activeTracking.branch) {
        console.log(
          chalk.yellow("\nWarning: You are currently on a different branch:")
        );
        console.log(`  Tracking: ${chalk.cyan(config.activeTracking.branch)}`);
        console.log(`  Current: ${chalk.cyan(currentBranch)}`);
      }
    } catch (error: unknown) {
      console.error(
        chalk.red("✗ Error getting status:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

export async function syncTempo(options: { date: string }) {
  const config = await getConfig();

  if (!config.apiKey || !config.jiraAccountId) {
    console.log(
      chalk.yellow("\nSync requires configuration. Run setup first:")
    );
    console.log(chalk.blue("  tempo setup"));
    return;
  }

  // Get activities for the specified date
  const activityLog = await getActivityLog();
  const dateActivities = activityLog.filter((activity) => {
    return activity.startTime.startsWith(options.date) && !activity.synced;
  });

  if (dateActivities.length === 0) {
    console.log(
      chalk.yellow(`No unsynced activities found for ${options.date}.`)
    );
    return;
  }

  console.log(
    `Syncing ${chalk.cyan(dateActivities.length)} activities to Tempo...`
  );

  let successCount = 0;
  let failCount = 0;

  for (const activity of dateActivities) {
    try {
      if (!activity.endTime) {
        console.log(
          chalk.yellow(`Skipping activity without end time: ${activity.branch}`)
        );
        continue;
      }

      // Skip activities less than 1 minute
      const startTime = new Date(activity.startTime);
      const endTime = new Date(activity.endTime);
      const durationSeconds = Math.round(
        (endTime.getTime() - startTime.getTime()) / 1000
      );

      if (durationSeconds < 60) {
        console.log(
          chalk.yellow(
            `Skipping activity shorter than 1 minute: ${activity.branch}`
          )
        );
        continue;
      }

      // Prepare worklog data
      const description =
        activity.description || `Work on branch: ${activity.branch}`;
      const issueId = activity.issueId;

      if (!issueId) {
        console.log(
          chalk.yellow(
            `No issue ID for activity on branch ${activity.branch}. Please provide one:`
          )
        );

        const { providedIssueId } = await inquirer.prompt([
          {
            type: "input",
            name: "providedIssueId",
            message: "Enter Jira issue ID:",
            validate: (input) =>
              !!input || "Issue ID is required for syncing to Tempo",
          },
        ]);

        await updateActivityLog(activity.id, { issueId: providedIssueId });
        activity.issueId = providedIssueId;
      }

      const config = await getConfig();
      if (!config.jiraAccountId) {
        throw new Error("Jira Account ID not configured");
      }
      await createTempoWorklog({
        issueId: activity.issueId,
        timeSpentSeconds: durationSeconds,
        startDate: options.date,
        startTime: startTime.toISOString().split("T")[1].slice(0, 5)!,
        description: description,
        authorAccountId: config.jiraAccountId,
      });

      // Mark as synced
      await updateActivityLog(activity.id, { synced: true });
      successCount++;

      console.log(
        chalk.green(
          `✓ Synced: ${activity.issueId} - ${durationSeconds / 60} minutes`
        )
      );
    } catch (error: unknown) {
      // console.log(error);
      console.error(chalk.red("✗ Error syncing to Tempo:"), String(error));
      failCount++;
    }
  }

  console.log(
    `\nSync complete: ${chalk.green(`${successCount} succeeded`)}, ${
      failCount > 0 ? chalk.red(`${failCount} failed`) : `${failCount} failed`
    }`
  );
}

function startBranchChecks() {
  // Stop any existing interval
  stopBranchChecks();

  // Create a new interval that checks every 15 minutes
  activeCheckInterval = setInterval(checkCurrentBranch, 15 * 60 * 1000);

  console.log(
    chalk.blue("Branch monitoring started (checking every 15 minutes).")
  );
}

function stopBranchChecks() {
  if (activeCheckInterval) {
    clearInterval(activeCheckInterval);
    activeCheckInterval = null;
  }
}

// Auto-stop timer
let autoStopTimer: any = null;

/**
 * Schedule auto-stop after 8 hours of tracking
 */
function scheduleAutoStop() {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
  }

  autoStopTimer = setTimeout(async () => {
    console.log(chalk.yellow("⏱ Auto-stopping tracking after 8 hours"));
    await stopTracking();
  }, MAX_TRACKING_TIME_MS);
}

/**
 * Cancel the auto-stop timer
 */
function cancelAutoStop() {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
}

/**
 * Start sending pulses to Tempo at regular intervals
 */
function startPulseSending() {
  if (!activePulseInterval) {
    // Send an initial pulse immediately
    sendPulse();

    // Then send pulses at regular intervals
    activePulseInterval = setInterval(sendPulse, PULSE_INTERVAL_MS);
  }
}

/**
 * Stop sending pulses to Tempo
 */
function stopPulseSending() {
  if (activePulseInterval) {
    clearInterval(activePulseInterval);
    activePulseInterval = null;
  }
}

/**
 * Send a pulse to Tempo with the current tracking information
 */
async function sendPulse() {
  const config = await getConfig();
  if (!config.apiKey || !config.jiraAccountId) {
    console.log(
      chalk.yellow("\nPulse feature requires configuration. Run setup first:")
    );
    console.log(chalk.blue("  tempo setup"));
    return;
  }
  try {
    if (!config.activeTracking) {
      return;
    }

    await sendTempoPulse({
      issueId: config.activeTracking.issueId,
      description: config.activeTracking.description,
    });

    // Log the pulse sending (only in debug mode)
    if (process.env.DEBUG) {
      console.log(
        chalk.gray(`Pulse sent for branch ${config.activeTracking.branch}`)
      );
    }
  } catch (error) {
    // Silent fail for pulses - they're just suggestions
    if (process.env.DEBUG) {
      console.error(chalk.gray("Failed to send pulse:"), error);
    }
  }
}

async function checkCurrentBranch() {
  try {
    const config = await getConfig();

    // If no active tracking, stop the interval
    if (!config.activeTracking) {
      stopBranchChecks();
      return;
    }

    // Get the current branch in the tracked directory
    const currentBranch = await getCurrentBranch(
      config.activeTracking.directory
    );

    if (currentBranch !== config.activeTracking.branch) {
      console.log(chalk.yellow("\nBranch change detected!"));
      console.log(
        `  Tracked branch: ${chalk.cyan(config.activeTracking.branch)}`
      );
      console.log(`  Current branch: ${chalk.cyan(currentBranch)}`);

      // Create log entry for the tracked time so far
      const endTime = new Date().toISOString();
      await addActivityLog({
        branch: config.activeTracking.branch,
        directory: config.activeTracking.directory,
        startTime: config.activeTracking.startTime,
        endTime,
        issueId: config.activeTracking.issueId,
        description: config.activeTracking.description,
      });

      // Update tracking to the new branch
      await updateConfig({
        activeTracking: {
          ...config.activeTracking,
          branch: currentBranch,
          startTime: endTime,
        },
      });

      console.log(
        chalk.green("✓ Tracking switched to new branch:"),
        chalk.cyan(currentBranch)
      );
    }
  } catch (error: unknown) {
    console.error("Error during branch check:", error);
  }
}

export async function startTrackingWithErrorHandling(options: {
  description?: string;
  issueId: number;
}) {
  try {
    await startTracking(options);
  } catch (error: unknown) {
    console.error(
      chalk.red("✗ Error starting tracking:"),
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function stopTrackingWithErrorHandling() {
  try {
    await stopTracking();
  } catch (error: unknown) {
    console.error(
      chalk.red("✗ Error stopping tracking:"),
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function statusTrackingWithErrorHandling() {
  try {
    await statusTracking();
  } catch (error: unknown) {
    console.error(
      chalk.red("✗ Error getting status:"),
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function syncTempoWithErrorHandling(options: { date: string }) {
  try {
    await syncTempo(options);
  } catch (error: unknown) {
    console.error(
      chalk.red("✗ Error syncing to Tempo:"),
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function handleConfigDeletionPrompt(
  key: keyof ConfigType,
  value: string
): Promise<"update" | "abort"> {
  if (value.trim() === "") {
    const { shouldDelete } = await inquirer.prompt({
      type: "confirm",
      name: "shouldDelete",
      message: `Empty value provided. Delete ${key} from config?`,
      default: false,
    });

    if (shouldDelete) {
      await updateConfig({ [key]: undefined });
      console.log(chalk.green(`✓ Removed ${key} from configuration`));
      return "abort"; // No further action needed
    }

    console.log(
      chalk.yellow("✗ Empty value rejected - keeping existing configuration")
    );
    return "abort"; // Cancel the update
  }
  return "update"; // Proceed with valid value
}

export async function setApiKeyCommand(key: string) {
  await updateConfig({ apiKey: key });
  console.log(chalk.green("✓ API key updated"));
}

export async function setJiraAccountIdCommand(id: string) {
  const action = await handleConfigDeletionPrompt("jiraAccountId", id);
  if (action === "abort") return;
  await updateConfig({ jiraAccountId: id });
  console.log(chalk.green("Jira Account ID configured successfully"));
}

export async function showConfigCommand() {
  const config = await getConfig();
  console.log(chalk.blue("Current Configuration:"));
  console.log(`Tempo Base URL: ${config.tempoBaseUrl}`);
  console.log(
    `API Key: ${(await getConfig()).apiKey ? "Configured" : "Not set"}`
  );
  console.log(`Jira Account ID: ${config.jiraAccountId || "Not set"}`);
}

interface WorklogDisplayOptions {
  limit?: number;
  date?: string;
  branch?: string;
  issueId?: number;
  all?: boolean;
  format?: "table" | "json";
}

/**
 * Display worklogs in a table format
 */
export async function displayWorklogs(options: WorklogDisplayOptions = {}) {
  const activityLog = await getActivityLog();

  // Apply filters
  let filteredLogs = [...activityLog];

  if (options.date) {
    filteredLogs = filteredLogs.filter((log) =>
      log.startTime.startsWith(options.date as string)
    );
  }

  if (options.branch) {
    filteredLogs = filteredLogs.filter((log) =>
      log.branch.includes(options.branch as string)
    );
  }

  if (options.issueId) {
    filteredLogs = filteredLogs.filter(
      (log) => log.issueId === options.issueId
    );
  }

  // Sort by start time (newest first)
  filteredLogs.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  // Apply limit if not showing all
  if (!options.all && options.limit) {
    filteredLogs = filteredLogs.slice(0, options.limit);
  }

  if (filteredLogs.length === 0) {
    console.log(chalk.yellow("No worklogs found matching the criteria."));
    return;
  }

  // Output as JSON if requested
  if (options.format === "json") {
    console.log(JSON.stringify(filteredLogs, null, 2));
    return;
  }

  // Display header
  console.log(chalk.bold("\nWorklogs:"));

  // Calculate column widths
  const dateWidth = 25;
  const durationWidth = 10;
  const branchWidth = 30;
  const issueWidth = 10;
  const descWidth = 40;
  const syncedWidth = 8;

  // Print header row
  console.log(
    chalk.blue("Date".padEnd(dateWidth)) +
      chalk.blue("Duration".padEnd(durationWidth)) +
      chalk.blue("Branch".padEnd(branchWidth)) +
      chalk.blue("Issue ID".padEnd(issueWidth)) +
      chalk.blue("Description".padEnd(descWidth)) +
      chalk.blue("Synced".padEnd(syncedWidth))
  );

  // Print separator
  console.log(
    "-".repeat(
      dateWidth +
        durationWidth +
        branchWidth +
        issueWidth +
        descWidth +
        syncedWidth
    )
  );

  // Print each worklog
  for (const log of filteredLogs) {
    const date = formatDate(log.startTime);
    const duration = formatDuration(log.startTime, log.endTime);
    const branch =
      log.branch.length > branchWidth - 3
        ? log.branch.substring(0, branchWidth - 3) + "..."
        : log.branch;
    const issueId = log.issueId ? log.issueId.toString() : "N/A";
    const description = log.description
      ? log.description.length > descWidth - 3
        ? log.description.substring(0, descWidth - 3) + "..."
        : log.description
      : "N/A";
    const synced = log.synced ? chalk.green("✓") : chalk.red("✗");

    console.log(
      date.padEnd(dateWidth) +
        duration.padEnd(durationWidth) +
        branch.padEnd(branchWidth) +
        issueId.padEnd(issueWidth) +
        description.padEnd(descWidth) +
        synced.padEnd(syncedWidth)
    );
  }

  // Print summary
  const totalDurationMs = filteredLogs.reduce((total, log) => {
    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : new Date();
    return total + (end.getTime() - start.getTime());
  }, 0);

  const totalHours = Math.floor(totalDurationMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor(
    (totalDurationMs % (1000 * 60 * 60)) / (1000 * 60)
  );

  console.log(
    "\n" +
      "-".repeat(
        dateWidth +
          durationWidth +
          branchWidth +
          issueWidth +
          descWidth +
          syncedWidth
      )
  );
  console.log(chalk.bold(`Total: ${totalHours}h ${totalMinutes}m`));

  // Show synced vs unsynced stats
  const syncedLogs = filteredLogs.filter((log) => log.synced);
  const unsyncedLogs = filteredLogs.filter((log) => !log.synced);

  console.log(chalk.green(`Synced: ${syncedLogs.length} worklogs`));
  console.log(chalk.yellow(`Unsynced: ${unsyncedLogs.length} worklogs`));
}

/**
 * Clear all logs
 */
export async function clearLogsCommand() {
  try {
    // Get current logs to check if there are any to clear
    const logs = await getActivityLog();
    
    if (logs.length === 0) {
      console.log(chalk.yellow("No logs to clear."));
      return;
    }
    
    // Ask for confirmation before clearing logs
    const { confirmClear } = await inquirer.prompt({
      type: "confirm",
      name: "confirmClear",
      message: chalk.yellow(`⚠️  Warning: This will permanently delete all ${logs.length} log entries. Are you sure?`),
      default: false, // Default to 'No' to prevent accidental deletion
    });
    
    if (!confirmClear) {
      console.log(chalk.blue("Operation cancelled. Your logs are safe."));
      return;
    }
    
    await clearActivityLog();
    console.log(chalk.green("✓ All logs have been cleared."));
  } catch (error: any) {
    console.error(chalk.red("✗ Error clearing logs:"), error.message);
  }
}

/**
 * List logs with error handling
 */
export async function listLogsCommand(options: WorklogDisplayOptions = {}) {
  try {
    await displayWorklogs(options);
  } catch (error: any) {
    console.error(chalk.red("✗ Error displaying logs:"), error.message);
  }
}



export async function setupCommand() {
  const { apiKey } = await inquirer.prompt([
    {
      type: "input",
      name: "apiKey",
      message: "Enter your Tempo API key:",
      validate: (input) => !!input || "API key is required",
    },
  ]);

  const { jiraAccountId } = await inquirer.prompt([
    {
      type: "input",
      name: "jiraAccountId",
      message: "Enter your Jira Account ID:",
      validate: (input) => !!input || "Jira Account ID is required",
    },
  ]);

  await updateConfig({ apiKey, jiraAccountId });
  console.log(chalk.green("✓ Configuration saved!"));
}

/**
 * Start the daemon with error handling
 */
export async function startDaemonWithErrorHandling(): Promise<void> {
  try {
    await startDaemon();
  } catch (error: any) {
    console.error(chalk.red("✗ Error starting daemon:"), error.message);
  }
}

/**
 * Stop the daemon with error handling
 */
export async function stopDaemonWithErrorHandling(): Promise<void> {
  try {
    await stopDaemon();
  } catch (error: any) {
    console.error(chalk.red("✗ Error stopping daemon:"), error.message);
  }
}

/**
 * Check daemon status with error handling
 */
export async function statusDaemonWithErrorHandling(): Promise<void> {
  try {
    await statusDaemon();
  } catch (error: any) {
    console.error(chalk.red("✗ Error checking daemon status:"), error.message);
  }
}

/**
 * Start tracking via daemon with error handling
 */
export async function startTrackingViaDaemonWithErrorHandling(options: {
  description?: string;
  issueId?: number;
}): Promise<void> {
  try {
    await startTrackingViaDaemon(options);
  } catch (error: any) {
    console.error(chalk.red("✗ Error starting tracking via daemon:"), error.message);
  }
}

/**
 * Stop tracking via daemon with error handling
 */
export async function stopTrackingViaDaemonWithErrorHandling(): Promise<void> {
  try {
    await stopTrackingViaDaemon();
  } catch (error: any) {
    console.error(chalk.red("✗ Error stopping tracking via daemon:"), error.message);
  }
}
