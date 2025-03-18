import Conf from "conf";
import { z } from "zod";

const configSchema = z.object({
  tempoBaseUrl: z.string().default("https://api.eu.tempo.io/4"),
  apiKey: z.string().optional(),
  jiraAccountId: z.string().optional(),
  activeTracking: z
    .object({
      branch: z.string(),
      directory: z.string(),
      startTime: z.string(),
      issueId: z.number(),
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
        issueId: z.number(),
        description: z.string().optional(),
        synced: z.boolean().default(false),
      })
    )
    .default([]),
});

export type ConfigType = z.infer<typeof configSchema>;

let config: Conf<ConfigType>;

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
      activeTracking: {
        type: "object",
        properties: {
          branch: { type: "string" },
          directory: { type: "string" },
          startTime: { type: "string" },
          issueId: { type: "number" },
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

export const clearActivityLog = async () => {
  await updateConfig({ activityLog: [] });
};
