#!/usr/bin/env bun

import { $, file, argv } from "bun";
import { join } from "path";
import { readFileSync } from "fs";

const rootDir = join(import.meta.dir, "..");

// Check if we're running in CI
if (!process.env.CI) {
  console.error("❌ This script should only be run in CI environment");
  process.exit(1);
}

// Get the tag from git
const getTaggedVersion = async () => {
  try {
    const output = await $`git tag --list --points-at HEAD`.text();
    return output.replace(/^v|\n+$/g, "");
  } catch (error) {
    console.error("❌ Failed to get tagged version:", error);
    process.exit(1);
  }
};

const publishPackage = async (pkgPath: string, tag: string) => {
  try {
    const pkgJsonPath = join(pkgPath, "package.json");
    const pkgContent = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const name = pkgContent.name;

    console.log(`📦 Publishing ${name} with tag ${tag}...`);

    // For experimental releases, we need to use --no-git-checks
    const args = ["--access", "public", "--tag", tag];
    if (tag === "experimental") {
      args.push("--no-git-checks");
    }

    await $`cd ${pkgPath} && npm publish ${args}`;
    console.log(`✅ Published ${name}@${pkgContent.version}`);
  } catch (error) {
    console.error(`❌ Failed to publish package at ${pkgPath}:`, error);
  }
};

const run = async () => {
  try {
    // Get the current tagged version
    const version = await getTaggedVersion();

    if (!version) {
      console.error("❌ No version tag found. Run the version script first.");
      process.exit(1);
    }

    console.log(`📦 Publishing version ${version}`);

    // Determine which tag to use
    let tag = "latest";
    if (version.includes("experimental")) {
      tag = "experimental";
    } else if (version.includes("beta")) {
      tag = "beta";
    } else if (version.includes("alpha")) {
      tag = "alpha";
    }

    console.log(`🏷️ Using npm tag: ${tag}`);

    // Publish packages in the correct order
    await publishPackage(join(rootDir, "packages/core"), tag);
    await publishPackage(join(rootDir, "packages/backend"), tag);
    await publishPackage(join(rootDir, "packages/daemon"), tag);
    await publishPackage(join(rootDir, "packages/cli"), tag);

    console.log("✅ All packages published successfully!");
  } catch (error) {
    console.error(`❌ Error during publish:`, error);
    process.exit(1);
  }
};

run();
