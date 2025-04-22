# Release Process for Tempo CLI

This document outlines the process for releasing new versions of the Tempo CLI tool, including both stable and beta releases.

## Automated GitHub Publish Flow

The project uses GitHub Actions to automate the build, test, and publish process while maintaining manual control over releases.

### Workflow Overview

1. **Continuous Integration (CI)**
   - Runs on every push to `main` branch and pull requests
   - Performs type checking, runs tests, and builds the application
   - Ensures code quality without publishing

2. **Release Process**
   - Triggered manually by creating a new GitHub Release
   - Automatically builds, tests, and publishes to npm
   - Uses the GitHub release tag as the package version

## How to Create a Release

### 1. Create a Changeset

Run:
```bash
bun run changeset
```
Follow the prompts to document your changes. This creates a file in `.changeset/`.

### 2. Version Packages

Review and merge the pending changeset PR (if using GitHub Action) or locally run:
```bash
bun run version
git push --follow-tags
```
This will bump all package versions and commit the changes.

### 3. Create a GitHub Release

Go to GitHub → **Releases** → **Draft a new release**, select the new tag (e.g. `v1.2.3` or `v1.2.3-beta.0`), add release notes, and publish.

### 4. Automated Publishing

Once the release is published, the GitHub Actions workflows will:

- Build and test the code
- Use the Changesets GitHub Action to publish packages to npm (with `latest` for stable or `beta` for prereleases)

### 5. Installing Beta Versions

To install the latest beta version:

```bash
npm install -g @nicorodri/tempo-cli@beta
```

To install a specific beta version:

```bash
npm install -g @nicorodri/tempo-cli@1.0.0-beta.0
```

Beta versions are perfect for:
- Testing new features before they're generally available
- Gathering feedback on upcoming changes
- Verifying compatibility with your workflow

## Release Notes Guidelines

When creating release notes, include:

1. **Summary**: Brief overview of the release
2. **New Features**: List of new features with brief descriptions
3. **Bug Fixes**: List of fixed issues
4. **Breaking Changes**: Any changes that break backward compatibility
5. **Dependencies**: Updates to dependencies

## Troubleshooting

If the automated publish fails:

1. Check the GitHub Actions logs for errors
2. Ensure you have the NPM_TOKEN secret set in your GitHub repository
3. Verify that the package version is unique and follows semver
4. Make sure the build process completes successfully

The npm publish step requires the `NPM_TOKEN` secret to be configured in your GitHub repository settings.
