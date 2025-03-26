#!/bin/bash

# Ensure the script stops on first error
set -e

# Check if a version bump type is provided
if [ -z "$1" ]; then
  echo "Error: No version bump type specified"
  echo "Usage: ./scripts/publish.sh [major|minor|patch]"
  exit 1
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Please commit or stash your changes."
  exit 1
fi

# Make sure we're on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Not on main branch. Please switch to main branch before publishing."
  exit 1
fi

# Pull latest changes
echo "Pulling latest changes from main..."
git pull origin main

# Build the project to ensure everything compiles
echo "Building project..."
bun run build

# Bump the version
echo "Bumping $1 version..."
npm version $1

# Push the changes and tags
echo "Pushing to GitHub..."
git push && git push --tags

# Publish to npm
echo "Publishing to npm..."
npm publish

echo "Successfully published new $1 version!"