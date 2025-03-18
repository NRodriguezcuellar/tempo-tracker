import { getCurrentBranch, findGitRoot } from "./git";
import {
  getConfig,
  updateConfig,
  addActivityLog,
  updateActivityLog,
  getActivityLog,
} from "./config";
import { refreshTokenIfNeeded, setApiKey, getApiKey } from "./auth";
import chalk from "chalk";
import { createTempoWorklog } from "./api";

// Store active check interval
let activeCheckInterval: any = null;

export async function startTracking(options: {
  description?: string;
  issue?: string;
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

    const { default: inquirer } = await import("inquirer");
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
      issueKey: options.issue,
      description: options.description,
    },
  });

  console.log(
    chalk.green("✓ Started tracking time on branch:"),
    chalk.cyan(branch)
  );
  if (options.issue) {
    console.log(`  Issue: ${chalk.cyan(options.issue)}`);
  }
  if (options.description) {
    console.log(`  Description: ${chalk.cyan(options.description)}`);
  }

  // Start the branch check interval
  startBranchChecks();
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
    issueKey: config.activeTracking.issueKey,
    description: config.activeTracking.description,
  });

  // Clear active tracking
  await updateConfig({ activeTracking: undefined });

  // Stop the branch check interval
  stopBranchChecks();

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

  if (config.activeTracking.issueKey) {
    console.log(`  Issue: ${chalk.cyan(config.activeTracking.issueKey)}`);
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
    } catch (error) {
      console.error(
        chalk.red("✗ Error getting status:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

export async function syncTempo(options: { date: string }) {
  // Get the access token
  try {
    await refreshTokenIfNeeded();
  } catch (error: unknown) {
    console.error(
      chalk.red("Authentication error:"),
      error instanceof Error ? error.message : String(error)
    );
    console.log(
      chalk.yellow("Please run `tempo-tracker auth` to authenticate.")
    );
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
      const issueKey = activity.issueKey;

      if (!issueKey) {
        console.log(
          chalk.yellow(
            `No issue key for activity on branch ${activity.branch}. Please provide one:`
          )
        );

        const { default: inquirer } = await import("inquirer");
        const { providedIssueKey } = await inquirer.prompt([
          {
            type: "input",
            name: "providedIssueKey",
            message: "Enter Jira issue key:",
            validate: (input) =>
              !!input || "Issue key is required for syncing to Tempo",
          },
        ]);

        await updateActivityLog(activity.id, { issueKey: providedIssueKey });
        activity.issueKey = providedIssueKey;
      }

      // Create worklog in Tempo
      await createTempoWorklog({
        issueKey: activity.issueKey!,
        timeSpentSeconds: durationSeconds,
        startDate: options.date,
        startTime: startTime.toISOString().split("T")[1].slice(0, 5), // HH:MM format
        description,
      });

      // Mark as synced
      await updateActivityLog(activity.id, { synced: true });
      successCount++;

      console.log(
        chalk.green(
          `✓ Synced: ${activity.issueKey} - ${durationSeconds / 60} minutes`
        )
      );
    } catch (error: unknown) {
      console.error(
        chalk.red("✗ Error syncing to Tempo:"),
        error instanceof Error ? error.message : String(error)
      );
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
        issueKey: config.activeTracking.issueKey,
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
  issue?: string;
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

export async function setApiKeyCommand(key: string) {
  await setApiKey(key);
  console.log(chalk.green("API key configured successfully"));
}

export async function setJiraInstanceCommand(url: string) {
  await updateConfig({ jiraInstance: url });
  console.log(chalk.green("Jira URL configured"));
}

export async function showConfigCommand() {
  const config = await getConfig();
  console.log(chalk.blue("Current Configuration:"));
  console.log(`Tempo Base URL: ${config.tempoBaseUrl}`);
  console.log(`Jira Instance: ${config.jiraInstance || "Not set"}`);
  console.log(`API Key: ${(await getApiKey()) ? "Configured" : "Not set"}`);
}
