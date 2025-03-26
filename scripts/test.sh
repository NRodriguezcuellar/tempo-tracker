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

print_message "Running pre-publish tests..." "$YELLOW"

# Check if the project builds correctly
print_message "Building project..." "$YELLOW"
npm run build
if [[ $? -ne 0 ]]; then
  print_message "❌ Build failed" "$RED"
  exit 1
fi

# Test if the CLI can be executed
print_message "Testing CLI execution..." "$YELLOW"
node dist/index.js --help
if [[ $? -ne 0 ]]; then
  print_message "❌ CLI execution failed" "$RED"
  exit 1
fi

# Test if the CLI version command works
print_message "Testing version command..." "$YELLOW"
node dist/index.js --version
if [[ $? -ne 0 ]]; then
  print_message "❌ Version command failed" "$RED"
  exit 1
fi

# Test basic config command
print_message "Testing config command..." "$YELLOW"
node dist/index.js config show
if [[ $? -ne 0 ]]; then
  print_message "❌ Config command failed" "$RED"
  exit 1
fi

print_message "✅ All tests passed!" "$GREEN"
print_message "The package is ready for publishing." "$GREEN"
