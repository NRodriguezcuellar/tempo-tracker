#!/usr/bin/env node

/**
 * Pre-publish validation script
 * Ensures the package is in a valid state before publishing
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Check if package.json exists
const packageJsonPath = path.join(rootDir, "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error("❌ package.json not found");
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Validate required fields
const requiredFields = [
  "name",
  "version",
  "description",
  "main",
  "bin",
  "files",
];
const missingFields = requiredFields.filter((field) => !packageJson[field]);

if (missingFields.length > 0) {
  console.error(
    `❌ Missing required fields in package.json: ${missingFields.join(", ")}`
  );
  process.exit(1);
}

// Check if dist directory exists
const distDir = path.join(rootDir, "dist");
if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found. Run "bun run build" first.');
  process.exit(1);
}

// Check if main entry point exists
const mainFile = path.join(rootDir, packageJson.main);
if (!fs.existsSync(mainFile)) {
  console.error(`❌ Main entry point ${packageJson.main} not found`);
  process.exit(1);
}

// Check if bin file exists
const binFile = path.join(rootDir, Object.values(packageJson.bin)[0]);
if (!fs.existsSync(binFile)) {
  console.error(
    `❌ Binary file ${Object.values(packageJson.bin)[0]} not found`
  );
  process.exit(1);
}

console.log("✅ Package validation successful! Ready to publish.");
process.exit(0);
