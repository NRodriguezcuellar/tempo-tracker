#!/usr/bin/env bun

import { $, file, argv } from "bun";
import { join } from "path";

const rootDir = join(import.meta.dir, "..");

// Check if we have a branch name argument
const branchName = argv[2];
if (!branchName) {
  console.error("❌ No branch name specified");
  console.error("Usage: bun run scripts/experimental-release.ts <branch-name>");
  process.exit(1);
}

const run = async () => {
  try {
    // Checkout the specified branch
    console.log(`🔀 Checking out branch: ${branchName}`);
    await $`git checkout ${branchName}`;

    // Get the short git hash for versioning
    const shortHash = await $`git rev-parse --short HEAD`.text();
    const experimentalVersion = `0.0.0-experimental-${shortHash.trim()}`;

    console.log(`🏷️ Creating experimental version: ${experimentalVersion}`);

    // Create a new branch for this experimental release
    const experimentalBranch = `experimental/${experimentalVersion}`;
    await $`git checkout -b ${experimentalBranch}`;

    // Update versions in all packages
    console.log(`📝 Updating package versions to ${experimentalVersion}`);
    await $`bun run scripts/version.ts ${experimentalVersion}`;

    // Commit the version changes
    await $`git config --local user.email "bot@tempo-cli.dev"`;
    await $`git config --local user.name "Tempo CLI Bot"`;
    await $`git add -A`;
    await $`git commit -m "chore: update version to ${experimentalVersion}"`;

    // Create a git tag
    await $`git tag ${experimentalVersion}`;
    await $`git push origin ${experimentalBranch} --tags`;

    // Build all packages
    console.log(`🏗️ Building all packages`);
    await $`bun run build`;

    // Publish packages with experimental tag
    console.log(`🚀 Publishing packages with experimental tag`);
    await $`CI=true bun run scripts/publish.ts`;

    console.log(
      `✅ Experimental release ${experimentalVersion} completed successfully!`
    );
  } catch (error) {
    console.error(`❌ Error during experimental release:`, error);
    process.exit(1);
  }
};

run();
