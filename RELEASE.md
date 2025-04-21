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

### 1. Update Version Locally

#### Stable Releases

Use one of the npm version commands to update the version in package.json:

```bash
# For patch releases (bug fixes) - 1.0.0 -> 1.0.1
npm run release:patch

# For minor releases (new features) - 1.0.0 -> 1.1.0
npm run release:minor

# For major releases (breaking changes) - 1.0.0 -> 2.0.0
npm run release:major
```

#### Beta Releases

For beta releases, use one of the following commands:

```bash
# For beta releases from the current version - 1.0.0 -> 1.0.0-beta.0
npm run release:beta

# For beta patch releases - 1.0.0 -> 1.0.1-beta.0
npm run release:beta-patch

# For beta minor releases - 1.0.0 -> 1.1.0-beta.0
npm run release:beta-minor

# For beta major releases - 1.0.0 -> 2.0.0-beta.0
npm run release:beta-major
```

These commands will:
- Update the version in package.json
- Create a git tag with the new version
- Commit the changes with a message "Release x.y.z" or "Release beta x.y.z-beta.n"

### 2. Push Changes and Tags

Push both the commit and the tag to GitHub:

```bash
git push && git push --tags
```

### 3. Create a GitHub Release

#### For Stable Releases

1. Go to the GitHub repository
2. Navigate to "Releases" section
3. Click "Create a new release"
4. Select the tag you just pushed
5. Add a title (typically "v1.0.0")
6. Add release notes describing the changes
7. Click "Publish release"

#### For Beta Releases

1. Go to the GitHub repository
2. Navigate to "Releases" section
3. Click "Create a new release"
4. Select the tag you just pushed (e.g., "v1.0.0-beta.0")
5. Add a title (typically "v1.0.0-beta.0")
6. Add release notes describing the changes and clearly mark it as a beta release
7. **Important**: Check the "This is a pre-release" checkbox
8. Click "Publish release"

### 4. Automated Publishing

#### For Stable Releases

The release workflow will automatically:
- Checkout the code at the tagged version
- Install dependencies
- Run type checking
- Build the application
- Update the version from the release tag
- Publish to npm with the `latest` tag

#### For Beta Releases

The beta release workflow will automatically:
- Checkout the code at the tagged version
- Install dependencies
- Run type checking
- Build the application
- Update the version from the release tag
- Publish to npm with the `beta` tag

### 5. Installing Beta Versions

To install the latest beta version:

```bash
npm install -g tempo-tracker@beta
```

To install a specific beta version:

```bash
npm install -g tempo-tracker@1.0.0-beta.0
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
