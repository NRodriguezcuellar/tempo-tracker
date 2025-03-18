import express from "express";
import open from "open";
import axios from "axios";
import { storeToken, getTokens } from "./secure-store";
import { getConfig, updateConfig } from "./config";
import chalk from "chalk";

const PORT = 3000;

export async function getApiKey(): Promise<string> {
  const apiKey = await getTokens("tempo_api_key");
  if (!apiKey) {
    throw new Error(
      "No API key configured. Run `tempo-tracker config api-key`"
    );
  }
  return apiKey;
}

export async function setApiKey(key: string): Promise<void> {
  await storeToken("tempo_api_key", key);
}

export async function authenticate() {
  const config = await getConfig();

  if (!config.jiraInstance) {
    const { default: inquirer } = await import("inquirer");

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "jiraInstance",
        message: "Enter your Jira instance URL:",
        validate: (input) => !!input || "Jira URL required",
      },
    ]);

    await updateConfig({ jiraInstance: answers.jiraInstance });
  }

  return getApiKey();
}

export async function refreshTokenIfNeeded() {
  return getApiKey();
}
