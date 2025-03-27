#!/usr/bin/env node

/**
 * Tempo CLI - Main Entry Point
 *
 * This is the main entry point for the Tempo CLI application.
 * It initializes the configuration and runs the CLI.
 */

import { initConfig } from "./config";
import { runCli } from "./cli";

// Initialize and run the CLI
async function main() {
  // Initialize configuration
  await initConfig();

  // Run the CLI
  runCli();
}

main();
