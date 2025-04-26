# Release Process for Tempo CLI

This document outlines the process for releasing new versions of the Tempo CLI tool, including stable and experimental releases.

## Automated GitHub Publish Flow

The project uses GitHub Actions with Changesets to automate the build, test, and publish process while maintaining manual control over releases.

### Workflow Overview

1. **Continuous Integration (CI)**
   - Runs on every push to `main` branch and pull requests
   - Performs type checking, runs tests, and builds the application
   - Ensures code quality without publishing

2. **Regular Release Process**
   - Triggered when changes are pushed to the `release` branch
   - Uses Changesets to version and publish packages
   - Automatically builds, tests, and publishes to npm with the appropriate tags

3. **Experimental Release Process**
   - Can be triggered manually via GitHub Actions with a specified branch
   - Uses the format `0.0.0-experimental-{short-git-hash}` for versioning
   - Publishes packages to npm with the "experimental" tag

## How to Create a Regular Release

### 1. Create a Changeset

Run:
```bash
pnpm changeset
```
Follow the prompts to document your changes. This creates a file in `.changeset/`.

### 2. Push Changes to the Release Branch

Once your changes and changesets are ready:
```bash
git checkout release
git merge main
git push
```

This will trigger the Changesets GitHub Action which will:
- Bump all package versions according to the changesets
- Commit the version changes
- Publish packages to npm with the appropriate tag (latest, beta, or alpha)

## How to Create an Experimental Release

Experimental releases provide a way to test the very latest changes, directly from specific Git branches without creating formal releases.

### Workflow Overview

1. **Experimental Release Process**
   - Triggered manually via GitHub Actions with a specified branch
   - Uses the format `0.0.0-experimental-{short-git-hash}` for versioning
   - Publishes packages to npm with the "experimental" tag

### How to Create an Experimental Release

#### 1. Manually Trigger GitHub Action

Go to GitHub → **Actions** → **🧪 Experimental Release** workflow → **Run workflow**, select the branch to release from, and start the workflow.

Alternatively, you can run the process locally:

```bash
# Update versions across the monorepo
pnpm run version:experimental

# Publish packages to npm with experimental tag
pnpm run publish:experimental

# Or run the entire process
pnpm run release:experimental
```

### Installing Experimental Versions

To install the latest experimental version:

```bash
npm install -g @nicorodri/tempo-cli@experimental
```

Experimental versions are ideal for:
- Testing changes directly from development branches
- Sharing work-in-progress features with collaborators
- Verifying fixes before they're integrated into the main branch

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