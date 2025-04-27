/**
 * CLI commands for Tempo CLI
 *
 * Implements the command handlers for the CLI
 */

import chalk from "chalk";
import inquirer from "inquirer";
import Table from "cli-table3";
import {
  // Utility functions
  formatDate,
  formatDuration,
  // Config functions
  getConfig,
  updateConfig,
  getActivityLog,
  clearActivityLog,
  ConfigType,
  // Git functions
  findGitRoot,
  ActivityLogEntry,
  TrackingSession,
} from "@nicorodri/tempo-core";

// Import daemon functions from the dedicated daemon package
import {
  startDaemon,
  stopDaemon,
  isDaemonRunning,
  viewDaemonLogs,
} from "@nicorodri/tempo-daemon";

// Client functions (will need to be implemented in the CLI package or imported from a client package)
import { getStatus, startTracking, stopTracking, syncTempo } from "./client";

/**
 * Start tracking with error handling
 */
export async function startTrackingWithErrorHandling(
  options: {
    description?: string;
    issueId?: number;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if daemon is running
    if (!isDaemonRunning()) {
      console.log(chalk.yellow("Daemon is not running. Starting it now..."));
      await startDaemon();

      // Wait a moment for the daemon to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Get current git branch if not provided
    const gitRoot = findGitRoot(process.cwd());
    if (!gitRoot) {
      console.log(chalk.red("✗ Not in a git repository"));
      return {
        success: false,
        error: "Not in a git repository",
      };
    }

    // Start tracking with required parameters
    const session = await startTracking({
      issueId: options.issueId,
      description: options.description,
    });

    console.log(
      chalk.green("✓ Started tracking time on branch:"),
      chalk.cyan(session.branch),
    );

    if (options.issueId) {
      console.log(`  Issue: ${chalk.cyan(options.issueId)}`);
    }

    if (options.description) {
      console.log(`  Description: ${chalk.cyan(options.description)}`);
    }

    console.log(
      chalk.blue("  Tracking is being managed by the daemon process."),
    );
    return {
      success: true,
    };
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Stop tracking with error handling
 */
export async function stopTrackingWithErrorHandling(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get the current working directory
    const cwd = process.cwd();

    // Check if we're in a git repository
    const gitRoot = findGitRoot(cwd);
    if (!gitRoot) {
      throw new Error(
        "Not in a git repository. Please navigate to a git repository to stop tracking.",
      );
    }

    // Check if daemon is running
    if (!isDaemonRunning()) {
      throw new Error(
        "Daemon is not running. Start it with 'tempo daemon start' first.",
      );
    }

    // Check if there's an active session for this repository
    const status = await getStatus();
    const activeSession = status.activeSessions.find(
      (session) => session.directory === gitRoot,
    );

    if (!activeSession) {
      console.log(
        chalk.yellow("No active tracking session for this repository."),
      );
      return {
        success: false,
        error: "No active tracking session for this repository",
      };
    }

    // Stop tracking
    const session = await stopTracking();

    if (!session) {
      console.log(chalk.yellow("No active tracking session to stop."));
      return {
        success: false,
        error: "No active tracking session to stop",
      };
    }

    // Calculate duration
    const startTime = new Date(session.startTime);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    console.log(chalk.green("✓ Stopped tracking time"));
    console.log(`  Branch: ${chalk.cyan(session.branch)}`);
    console.log(`  Duration: ${chalk.cyan(`${hours}h ${minutes}m`)}`);

    if (session.issueId) {
      console.log(`  Issue: ${chalk.cyan(session.issueId)}`);
    }

    if (session.description) {
      console.log(`  Description: ${chalk.cyan(session.description)}`);
    }

    console.log(chalk.blue("  Session has been saved to activity log."));
    console.log(chalk.blue("  Use 'tempo sync' to sync with Tempo."));
    return {
      success: true,
    };
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Status tracking with error handling
 */
export async function statusTrackingWithErrorHandling(): Promise<{
  error?: string;
  isTrackingCurrentBranch?: boolean;
  currentActiveSessions?: TrackingSession[];
}> {
  try {
    // Check if daemon is running
    const daemonRunning = isDaemonRunning();

    if (!daemonRunning) {
      console.log(chalk.yellow("Daemon is not running."));
      console.log(chalk.blue("Start the daemon with: tempo daemon start"));
      return {
        isTrackingCurrentBranch: false,
      };
    }

    // Get status from daemon
    const status = await getStatus();

    // Get the current working directory
    const cwd = process.cwd();

    // Check if we're in a git repository
    const gitRoot = findGitRoot(cwd);

    if (status.activeSessions.length === 0) {
      console.log(chalk.yellow("No active tracking sessions."));
      return {
        isTrackingCurrentBranch: false,
      };
    }

    // If we're in a git repository, show the session for this repository first
    if (gitRoot) {
      const sessionForThisRepo = status.activeSessions.find(
        (session) => session.directory === gitRoot,
      );

      if (sessionForThisRepo) {
        console.log(
          chalk.green("✓ Active tracking session for this repository:"),
        );
        displaySession(sessionForThisRepo);

        // If there are other sessions, show them too
        const otherSessions = status.activeSessions.filter(
          (session) => session.directory !== gitRoot,
        );

        if (otherSessions.length > 0) {
          console.log(chalk.blue("\nOther active tracking sessions:"));
          otherSessions.forEach((session) => {
            displaySession(session);
          });
        }

        return {
          isTrackingCurrentBranch: true,
        };
      }
    }

    // If we're not in a git repository or there's no session for this repository,
    // show all active sessions
    console.log(chalk.blue("Active tracking sessions:"));
    status.activeSessions.forEach((session) => {
      displaySession(session);
    });
    return {
      isTrackingCurrentBranch: false,
      currentActiveSessions: status.activeSessions,
    };
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
    return {
      error: error.message,
    };
  }
}

/**
 * Display a session in a formatted way
 */
function displaySession(session: any): void {
  console.log(`\n  Repository: ${chalk.cyan(session.directory)}`);
  console.log(`  Branch: ${chalk.cyan(session.branch)}`);
  console.log(
    `  Started: ${chalk.cyan(new Date(session.startTime).toLocaleString())}`,
  );

  if (session.issueId) {
    console.log(`  Issue: ${chalk.cyan(session.issueId)}`);
  }

  if (session.description) {
    console.log(`  Description: ${chalk.cyan(session.description)}`);
  }

  // Calculate duration
  const startTime = new Date(session.startTime);
  const now = new Date();
  const durationMs = now.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  console.log(`  Duration: ${chalk.cyan(`${hours}h ${minutes}m`)}`);
}

/**
 * Sync with Tempo with error handling
 */
export async function syncTempoWithErrorHandling(
  options: { date?: string } = {},
): Promise<void> {
  try {
    // Check if daemon is running
    if (!isDaemonRunning()) {
      throw new Error(
        "Daemon is not running. Start it with 'tempo daemon start' first.",
      );
    }

    // Sync with Tempo
    const result = await syncTempo(options);

    if (result.synced === 0 && result.failed === 0) {
      console.log(
        chalk.yellow("No activities to sync for the specified date."),
      );
      return;
    }

    if (result.synced > 0) {
      console.log(chalk.green(`✓ Synced ${result.synced} activities to Tempo`));
    }

    if (result.failed > 0) {
      console.log(
        chalk.yellow(`⚠ Failed to sync ${result.failed} activities`),
      );
    }
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Handle config deletion prompt
 */
export async function handleConfigDeletionPrompt(
  key: keyof ConfigType,
  value: string,
): Promise<"update" | "abort"> {
  const { shouldContinue } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldContinue",
      message: `The ${key} is already set to "${value}". Do you want to overwrite it?`,
      default: false,
    },
  ]);

  return shouldContinue ? "update" : "abort";
}

/**
 * Set API key command
 */
export async function setApiKeyCommand(key: string): Promise<void> {
  try {
    const config = await getConfig();

    if (config.apiKey && config.apiKey !== key) {
      const action = await handleConfigDeletionPrompt("apiKey", config.apiKey);
      if (action === "abort") {
        console.log(chalk.yellow("Operation aborted."));
        return;
      }
    }

    await updateConfig({ apiKey: key });
    console.log(chalk.green("✓ API key updated successfully"));
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Set Jira account ID command
 */
export async function setJiraAccountIdCommand(id: string): Promise<void> {
  try {
    const config = await getConfig();

    if (config.jiraAccountId && config.jiraAccountId !== id) {
      const action = await handleConfigDeletionPrompt(
        "jiraAccountId",
        config.jiraAccountId,
      );
      if (action === "abort") {
        console.log(chalk.yellow("Operation aborted."));
        return;
      }
    }

    await updateConfig({ jiraAccountId: id });
    console.log(chalk.green("✓ Jira account ID updated successfully"));
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Show config command
 */
export async function showConfigCommand(): Promise<void> {
  try {
    const config = await getConfig();

    console.log(chalk.blue("Current configuration:"));
    console.log(`  Tempo Base URL: ${chalk.cyan(config.tempoBaseUrl)}`);
    console.log(
      `  API Key: ${
        config.apiKey
          ? chalk.cyan(`${config.apiKey.substring(0, 4)}...`)
          : chalk.yellow("Not set")
      }`,
    );
    console.log(
      `  Jira Account ID: ${
        config.jiraAccountId
          ? chalk.cyan(config.jiraAccountId)
          : chalk.yellow("Not set")
      }`,
    );
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Display options for worklog listing
 */
export interface WorklogDisplayOptions {
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
export async function displayWorklogs(
  options: WorklogDisplayOptions = {},
): Promise<{
  success: boolean;
  activities?: ActivityLogEntry[];
  error?: string;
}> {
  try {
    const activities = await getActivityLog();

    if (activities.length === 0) {
      console.log(chalk.yellow("No activity logs found."));
      return {
        success: true,
        activities: [],
      };
    }

    // Apply filters
    let filteredActivities = [...activities];

    // Filter by date
    if (options.date) {
      const dateStart = new Date(options.date);
      dateStart.setHours(0, 0, 0, 0);

      const dateEnd = new Date(options.date);
      dateEnd.setHours(23, 59, 59, 999);

      filteredActivities = filteredActivities.filter((activity) => {
        const activityDate = new Date(activity.startTime);
        return activityDate >= dateStart && activityDate <= dateEnd;
      });
    }

    // Filter by branch
    if (options.branch) {
      filteredActivities = filteredActivities.filter(
        (activity) => activity.branch === options.branch,
      );
    }

    // Filter by issue ID
    if (options.issueId) {
      filteredActivities = filteredActivities.filter(
        (activity) => activity.issueId === options.issueId,
      );
    }

    // Filter by synced status
    if (!options.all) {
      filteredActivities = filteredActivities.filter(
        (activity) => !activity.synced,
      );
    }

    // Sort by start time (newest first)
    filteredActivities.sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

    // Apply limit
    if (options.limit && options.limit > 0) {
      filteredActivities = filteredActivities.slice(0, options.limit);
    }

    if (filteredActivities.length === 0) {
      console.log(chalk.yellow("No activity logs match the filters."));
      return {
        success: true,
        activities: filteredActivities,
      };
    }

    // Display in requested format
    if (options.format === "json") {
      console.log(JSON.stringify(filteredActivities, null, 2));
      return {
        success: true,
        activities: filteredActivities,
      };
    }

    // Display in table format
    console.log(chalk.blue("Activity logs:"));

    // Create a new table instance
    const table = new Table({
      head: [
        chalk.white.bold("Branch"),
        chalk.white.bold("Duration"),
        chalk.white.bold("Issue"),
        chalk.white.bold("Description"),
        chalk.white.bold("Synced"),
        chalk.white.bold("Date"),
      ],
      colWidths: [45, 15, 10, 30, 10, 20],
      wordWrap: true, // Enable wrapping,
      wrapOnWordBoundary: true,
      style: {
        head: [], // No additional styling for headers
        border: [], // No additional styling for borders
      },
      // Keep horizontal lines between rows for better readability
    });

    // Add rows to the table
    filteredActivities.forEach((activity) => {
      const startTime = new Date(activity.startTime);
      const endTime = activity.endTime
        ? new Date(activity.endTime)
        : new Date();

      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      table.push([
        chalk.cyan(activity.branch),
        chalk.cyan(formatDuration(startTime.toISOString(), activity.endTime)),
        activity.issueId ? chalk.cyan(activity.issueId) : chalk.gray("N/A"),
        activity.description
          ? chalk.cyan(activity.description)
          : chalk.gray("N/A"),
        activity.synced ? chalk.green("Yes") : chalk.yellow("No"),
        chalk.cyan(formatDate(startTime.toISOString())),
      ]);
    });

    // Print the table
    console.log(table.toString());
    console.log(chalk.blue(`Total: ${filteredActivities.length} activities`));
    return {
      success: true,
      activities: filteredActivities,
    };
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Clear logs command
 */
export async function clearLogsCommand(): Promise<void> {
  try {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message:
          "Are you sure you want to clear all activity logs? This cannot be undone.",
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("Operation aborted."));
      return;
    }

    await clearActivityLog();
    console.log(chalk.green("✓ All activity logs cleared"));
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * List logs command
 */
export async function listLogsCommand(
  options: WorklogDisplayOptions = {},
): Promise<void> {
  try {
    await displayWorklogs(options);
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Setup command
 */
export async function setupCommand(): Promise<void> {
  try {
    const config = await getConfig();

    // Check if already configured
    const isConfigured = config.apiKey && config.jiraAccountId;

    if (isConfigured) {
      console.log(chalk.green("Tempo CLI is already configured."));
      await showConfigCommand();

      const { reconfigure } = await inquirer.prompt([
        {
          type: "confirm",
          name: "reconfigure",
          message: "Do you want to reconfigure?",
          default: false,
        },
      ]);

      if (!reconfigure) {
        return;
      }
    }

    const { apiKey } = await inquirer.prompt([
      {
        type: "password",
        name: "apiKey",
        message: "Enter your Tempo API key:",
        validate: (input) => (input ? true : "API key is required"),
      },
    ]);

    // Get Jira account ID
    const { jiraAccountId } = await inquirer.prompt([
      {
        type: "input",
        name: "jiraAccountId",
        message: "Enter your Jira account ID:",
        validate: (input) => (input ? true : "Jira account ID is required"),
      },
    ]);

    // Update config
    await updateConfig({
      apiKey,
      jiraAccountId,
    });

    console.log(chalk.green("✓ Configuration completed successfully"));

    // Start daemon if not running
    if (!isDaemonRunning()) {
      const { startDaemonNow } = await inquirer.prompt([
        {
          type: "confirm",
          name: "startDaemonNow",
          message: "Do you want to start the daemon now?",
          default: true,
        },
      ]);

      if (startDaemonNow) {
        await startDaemonWithErrorHandling();
      } else {
        console.log(
          chalk.blue("You can start the daemon later with: tempo daemon start"),
        );
      }
    }
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Start daemon with error handling
 */
export async function startDaemonWithErrorHandling(): Promise<void> {
  try {
    // Check if daemon is already running
    if (isDaemonRunning()) {
      console.log(chalk.yellow("Tempo daemon is already running."));
      return;
    }

    await startDaemon();
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Stop daemon with error handling
 */
export async function stopDaemonWithErrorHandling(): Promise<void> {
  try {
    // Check if daemon is running
    if (!isDaemonRunning()) {
      console.log(chalk.yellow("Tempo daemon is not running."));
      return;
    }

    await stopDaemon();
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * Status daemon with error handling
 */
export async function statusDaemonWithErrorHandling(): Promise<void> {
  try {
    // Check if daemon is running
    const isRunning = isDaemonRunning();

    if (isRunning) {
      console.log(chalk.green("✓ Tempo daemon is running"));

      try {
        // Get daemon status
        const status = await getStatus();

        // Display active tracking sessions if any
        if (status.activeSessions.length > 0) {
          console.log(chalk.blue("\nActive tracking sessions:"));

          for (const session of status.activeSessions) {
            displaySession(session);
          }
        } else {
          console.log(chalk.yellow("\nNo active tracking sessions."));
        }
      } catch (error: any) {
        console.log(chalk.yellow(`\nError getting daemon status: ${error}`));
      }
    } else {
      console.log(chalk.yellow("Tempo daemon is not running."));
      console.log(chalk.blue("Start the daemon with: tempo daemon start"));
    }
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}

/**
 * View daemon logs with error handling
 */
export async function viewDaemonLogsWithErrorHandling(
  options: { lines?: number } = {},
): Promise<void> {
  try {
    const logs = viewDaemonLogs(options);

    if (logs.length === 0) {
      console.log(chalk.yellow("No daemon logs found."));
      return;
    }

    console.log(chalk.blue("Daemon logs:"));
    console.log("");

    logs.forEach((line) => {
      console.log(line);
    });
  } catch (error: any) {
    console.error(chalk.red(`✗ Error: ${error.message}`));
  }
}
