#!/usr/bin/env bun

import { $, file, argv } from "bun";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

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
    const pkgContent = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

    // Update version
    pkgContent.version = version;

    // If this package has dependencies on other @nicorodri/tempo-* packages,
    // update those dependency versions too
    for (const depType of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
    ]) {
      if (!pkgContent[depType]) continue;

      for (const [name, _] of Object.entries(pkgContent[depType])) {
        if (name.startsWith("@nicorodri/tempo-")) {
          pkgContent[depType][name] = version;
        }
      }
    }

    // Write updated package.json
    writeFileSync(pkgJsonPath, JSON.stringify(pkgContent, null, 2) + "\n");
    console.log(`✅ Updated ${pkgJsonPath}`);
  } catch (error) {
    console.error(`❌ Failed to update ${pkgPath}/package.json:`, error);
  }
};

// Update packages
await updatePackageVersion(join(rootDir, "packages/core"));
await updatePackageVersion(join(rootDir, "apps/backend"));
await updatePackageVersion(join(rootDir, "apps/daemon"));
await updatePackageVersion(join(rootDir, "apps/cli"));

console.log("✅ All packages updated to version", version);
