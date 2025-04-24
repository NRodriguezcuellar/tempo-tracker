#!/usr/bin/env bun

import { $, argv, file } from "bun";
import { join } from "path";

const rootDir = join(import.meta.dir, "..");
const version = argv[2];

if (!version) {
  console.error("❌ No version specified");
  console.error("Usage: bun run scripts/version.ts <version>");
  process.exit(1);
}

console.log(`📦 Setting version to ${version}`);

// Update package.json
const updatePackageVersion = async (pkgPath: string) => {
  try {
    const pkgJsonPath = join(pkgPath, "package.json");

    // Read the package.json file using Bun's file API
    const f = file(pkgJsonPath);
    const pkgContent = await f.json();

    // Update version
    pkgContent.version = version;

    // Write updated package.json using Bun's file API
    await Bun.write(pkgJsonPath, JSON.stringify(pkgContent, null, 2) + "\n");
    console.log(`✅ Updated ${pkgJsonPath}`);
  } catch (error) {
    console.error(`❌ Failed to update ${pkgPath}/package.json:`, error);
  }
};

// Update packages
await updatePackageVersion(join(rootDir, "packages/core"));
await updatePackageVersion(join(rootDir, "packages/backend"));
await updatePackageVersion(join(rootDir, "packages/daemon"));
await updatePackageVersion(join(rootDir, "packages/cli"));

console.log("✅ All packages updated to version", version);
