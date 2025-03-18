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
import { getApiKey } from "./auth";
import chalk from "chalk";
import { createTempoWorklog, sendTempoPulse } from "./api";
import inquirer from "inquirer";

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
  try {
    const config = await getConfig();

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
  const action = await handleConfigDeletionPrompt("apiKey", key);
  if (action === "abort") return;
  await updateConfig({ apiKey: key });
  console.log(chalk.green("API key configured successfully"));
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
  console.log(`API Key: ${(await getApiKey()) ? "Configured" : "Not set"}`);
  console.log(`Jira Account ID: ${config.jiraAccountId || "Not set"}`);
}

export async function clearLogsCommand() {
  try {
    await clearActivityLog();
    console.log("✅ Successfully cleared activity logs");
  } catch (error: unknown) {
    console.error(
      "❌ Error clearing logs:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
