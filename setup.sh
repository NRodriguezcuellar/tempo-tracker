# Create a new directory and initialize
mkdir tempo-tracker
cd tempo-tracker
bun init -y

# Install necessary dependencies
bun add commander     # For CLI structure
bun add simple-git    # For Git operations
bun add open          # For opening browser windows for OAuth
bun add express       # For OAuth callback server
bun add axios         # For API requests
bun add keytar        # For secure token storage
bun add node-cron     # For scheduling checks
bun add zod           # For validation
bun add chalk         # For colorful console output
bun add conf          # For configuration storage
bun add inquirer      # For interactive prompts

# Development dependencies
bun add -d typescript @types/node @types/express @types/inquirer