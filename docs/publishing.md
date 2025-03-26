# Publishing Guide for Tempo CLI

This document provides detailed instructions for publishing the Tempo CLI package to npm.

## Prerequisites

1. **npm Account**: You need an npm account to publish packages. If you don't have one, [create an account](https://www.npmjs.com/signup).

2. **npm Authentication**: You need to be logged in to npm:
   ```bash
   npm login
   ```

3. **GitHub Access**: For automated publishing via GitHub Actions, you need:
   - Write access to the repository
   - An npm token stored as a GitHub secret

## Manual Publishing

### One-Time Setup

1. **Verify package name availability**:
   ```bash
   npm view tempo-tracker
   ```
   If the package doesn't exist or you own it, you can publish.

2. **Update package.json**:
   Ensure all fields are correctly set:
   - `name`: Package name
   - `version`: Following semantic versioning
   - `description`: Clear description
   - `keywords`: Relevant search terms
   - `author`: Your name/organization
   - `license`: License type

### Publishing Process

You can publish using either of these methods:

#### Method 1: Using the publish script (Recommended)

```bash
./scripts/publish.sh
```

This interactive script will:
1. Check for uncommitted changes
2. Run tests (if available)
3. Build the project
4. Bump the version (patch, minor, major, or custom)
5. Publish to npm
6. Create a git tag and push changes

#### Method 2: Manual steps

```bash
# 1. Clean and build the project
npm run build

# 2. Bump version (patch, minor, major)
npm version [patch|minor|major]

# 3. Publish to npm
npm publish
```

## Automated Publishing with GitHub Actions

The repository includes GitHub Actions workflows for automated testing and publishing.

### Setup

1. **Generate npm token**:
   - Go to your npm account settings
   - Create a new Access Token with "Publish" permissions
   
2. **Add token to GitHub secrets**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add a new repository secret named `NPM_TOKEN` with your npm token

### Publishing via GitHub Release

1. Create a new release on GitHub:
   - Go to Releases → "Create a new release"
   - Tag version should match the version in package.json
   - Add release notes
   - Publish the release

2. The GitHub Actions workflow will automatically:
   - Run tests
   - Build the project
   - Publish to npm

## Version Management

Follow semantic versioning principles:
- **Patch** (1.0.0 → 1.0.1): Bug fixes
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "You need to be logged in" | Run `npm login` |
| "Package name already exists" | Choose a different package name |
| "Version already exists" | Bump the version number |
| "No auth token" | Ensure you're logged in or check GitHub secret |
| GitHub Actions failure | Check workflow logs for specific errors |

## Best Practices

1. **Always test before publishing**
2. **Update documentation** to reflect changes
3. **Add detailed release notes**
4. **Tag git commits** with version numbers
5. **Maintain a changelog** for user reference
