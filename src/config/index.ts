/**
 * Configuration management for Tempo CLI
 *
 * Handles storage and retrieval of application configuration
 * independent of any frontend.
 */

import Conf from "conf";
import { z } from "zod";

// Define the configuration schema using Zod
const configSchema = z.object({
  tempoBaseUrl: z.string().default("https://api.eu.tempo.io/4"),
  apiKey: z.string().optional(),
  jiraAccountId: z.string().optional(),
  activityLog: z
    .array(
      z.object({
        id: z.string(),
        branch: z.string(),
        directory: z.string(),
        startTime: z.string(),
        endTime: z.string().optional(),
        issueId: z.number(),
        description: z.string().optional(),
        synced: z.boolean().default(false),
      }),
    )
    .default([]),
});

export type ConfigType = z.infer<typeof configSchema>;
export type ActivityLogEntry = ConfigType["activityLog"][0];

let config: Conf<ConfigType>;

/**
 * Initialize the configuration store
 */
export async function initConfig() {
  config = new Conf<ConfigType>({
    projectName: "tempo-tracker",
    schema: {
      tempoBaseUrl: {
        type: "string",
        default: "https://api.eu.tempo.io/4",
      },
      jiraAccountId: {
        type: "string",
        default: "",
      },
      apiKey: {
        type: "string",
        default: "",
      },
      activityLog: {
        type: "array",
        default: [],
      },
    },
  });

  // Migrate or initialize if needed
  if (!config.has("activityLog")) {
    config.set("activityLog", []);
  }

  return config;
}

/**
 * Get the current configuration
 */
export async function getConfig(): Promise<ConfigType> {
  if (!config) {
    await initConfig();
  }
  return config.store;
}

/**
 * Update configuration with partial updates
 */
export async function updateConfig(
  updates: Partial<ConfigType>,
): Promise<ConfigType> {
  if (!config) {
    await initConfig();
  }

  for (const [key, value] of Object.entries(updates)) {
    const configKey = key as keyof ConfigType;
    if (value === undefined) {
      config.delete(configKey);
    } else {
      config.set(configKey, value);
    }
  }

  return config.store;
}

/**
 * Get the full activity log
 */
export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  const { activityLog } = await getConfig();
  return activityLog;
}

/**
 * Add a new entry to the activity log
 */
export async function addActivityLog(
  activity: Omit<ActivityLogEntry, "id" | "synced">,
): Promise<ActivityLogEntry> {
  const { activityLog } = await getConfig();
  const newActivity = {
    ...activity,
    id: crypto.randomUUID(),
    synced: false,
  };

  activityLog.push(newActivity);
  await updateConfig({ activityLog });
  return newActivity;
}

/**
 * Update an existing activity log entry
 */
export async function updateActivityLog(
  id: string,
  updates: Partial<Omit<ActivityLogEntry, "id">>,
): Promise<ActivityLogEntry> {
  const { activityLog } = await getConfig();
  const index = activityLog.findIndex((activity) => activity.id === id);

  if (index === -1) {
    throw new Error(`Activity with ID ${id} not found`);
  }

  activityLog[index] = {
    ...activityLog[index],
    ...updates,
  };

  await updateConfig({ activityLog });
  return activityLog[index];
}

/**
 * Clear all activity log entries
 */
export async function clearActivityLog(): Promise<void> {
  await updateConfig({ activityLog: [] });
}
