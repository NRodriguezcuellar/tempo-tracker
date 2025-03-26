#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  echo -e "${2}${1}${NC}"
}

# Check if working directory is clean
if [[ -n $(git status -s) ]]; then
  print_message "❌ You have uncommitted changes. Please commit or stash them before publishing." "$RED"
  exit 1
fi

# Get current version from package.json
current_version=$(node -p "require('./package.json').version")
print_message "Current version: $current_version" "$YELLOW"

# Ask for version bump type
echo "Select version bump type:"
echo "1) patch (1.0.0 -> 1.0.1)"
echo "2) minor (1.0.0 -> 1.1.0)"
echo "3) major (1.0.0 -> 2.0.0)"
echo "4) custom (enter version manually)"

read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    bump_type="patch"
    ;;
  2)
    bump_type="minor"
    ;;
  3)
    bump_type="major"
    ;;
  4)
    read -p "Enter custom version (x.y.z): " custom_version
    bump_type="custom"
    ;;
  *)
    print_message "❌ Invalid choice" "$RED"
    exit 1
    ;;
esac

# Confirm before proceeding
if [[ "$bump_type" == "custom" ]]; then
  new_version=$custom_version
  read -p "Are you sure you want to publish version $new_version? (y/n): " confirm
else
  read -p "Are you sure you want to publish a $bump_type version? (y/n): " confirm
fi

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  print_message "❌ Publishing canceled" "$RED"
  exit 1
fi

# Run tests if they exist
if grep -q "\"test\":" package.json; then
  print_message "Running tests..." "$YELLOW"
  npm test
  if [[ $? -ne 0 ]]; then
    print_message "❌ Tests failed. Fix the issues before publishing." "$RED"
    exit 1
  fi
fi

# Build the project
print_message "Building project..." "$YELLOW"
npm run build
if [[ $? -ne 0 ]]; then
  print_message "❌ Build failed. Fix the issues before publishing." "$RED"
  exit 1
fi

# Update version
if [[ "$bump_type" == "custom" ]]; then
  npm version $new_version --no-git-tag-version
else
  npm version $bump_type
fi

# Get new version
new_version=$(node -p "require('./package.json').version")
print_message "✅ Version bumped to $new_version" "$GREEN"

# Publish to npm
print_message "Publishing to npm..." "$YELLOW"
npm publish

if [[ $? -eq 0 ]]; then
  print_message "✅ Successfully published version $new_version to npm!" "$GREEN"
else
  print_message "❌ Failed to publish to npm. Please check the error messages above." "$RED"
  exit 1
fi

print_message "Done! 🎉" "$GREEN"
