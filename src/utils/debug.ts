/**
 * Debug utility functions for the Tempo CLI
 * 
 * Provides a consistent way to handle debug logging across the application
 */

import chalk from "chalk";

/**
 * Create a debug logger for a specific component
 * 
 * @param component - The name of the component generating the log
 * @returns A function that logs messages when DEBUG is enabled
 */
export function createDebugLogger(component: string) {
  const isDebugMode = process.env.DEBUG === "true";
  
  /**
   * Log a debug message when the DEBUG environment variable is set to "true"
   * 
   * @param message - The message to log
   */
  return function debugLog(message: string): void {
    if (isDebugMode) {
      const timestamp = new Date().toISOString();
      console.log(
        `${chalk.gray("[DEBUG]")}${chalk.blue(`[${timestamp}]`)}${chalk.cyan(`[${component}]`)} ${message}`
      );
    }
  };
}