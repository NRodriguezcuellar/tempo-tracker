import Conf from "conf";
import { z } from "zod";
import path from "path";
import os from "os";

const configSchema = z.object({
  jiraInstance: z.string().optional(),
  tempoBaseUrl: z.string().default("https://api.eu.tempo.io/4"),
  apiKey: z.string().optional(),
  activeTracking: z
    .object({
      branch: z.string(),
      directory: z.string(),
      startTime: z.string(),
      issueKey: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  activityLog: z
    .array(
      z.object({
        id: z.string(),
        branch: z.string(),
        directory: z.string(),
        startTime: z.string(),
        endTime: z.string().optional(),
        issueKey: z.string().optional(),
        description: z.string().optional(),
        synced: z.boolean().default(false),
      })
    )
    .default([]),
});

type ConfigType = z.infer<typeof configSchema>;

let config: Conf<ConfigType>;

export async function initConfig() {
  config = new Conf<ConfigType>({
    projectName: "tempo-tracker",
    schema: {
      jiraInstance: {
        type: "string",
        default: "",
      },
      tempoBaseUrl: {
        type: "string",
        default: "https://api.eu.tempo.io/4",
      },
      apiKey: {
        type: "string",
        default: "",
      },
      activeTracking: {
        type: "object",
        properties: {
          branch: { type: "string" },
          directory: { type: "string" },
          startTime: { type: "string" },
          issueKey: { type: "string" },
          description: { type: "string" },
        },
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

export async function getConfig(): Promise<ConfigType> {
  if (!config) {
    await initConfig();
  }
  return config.store;
}

export async function updateConfig(
  updates: Partial<ConfigType>
): Promise<ConfigType> {
  if (!config) {
    await initConfig();
  }

  Object.entries(updates).forEach(([key, value]) => {
    config.set(key as keyof ConfigType, value);
  });

  return config.store;
}

export async function getActivityLog() {
  const { activityLog } = await getConfig();
  return activityLog;
}

export async function addActivityLog(
  activity: Omit<ConfigType["activityLog"][0], "id" | "synced">
) {
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

export async function updateActivityLog(
  id: string,
  updates: Partial<Omit<ConfigType["activityLog"][0], "id">>
) {
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
