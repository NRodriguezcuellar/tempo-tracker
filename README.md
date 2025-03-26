# Tempo CLI - Git Branch Time Tracker

A command-line tool for tracking time spent on Git branches and seamlessly syncing with Tempo Timesheets.

## Features

- 🕒 Automatic time tracking per Git branch
- 🔄 Seamless Tempo API integration
- 💡 Smart worklog suggestions via Tempo Pulse API
- 📊 Comprehensive activity logging
- ⏱️ Auto-stop tracking after 8 hours
- 🔐 Secure credential storage
- 🔍 Detailed tracking history with filtering options

## Prerequisites

- [Node.js](https://nodejs.org/) runtime (for using the CLI)
- [Bun](https://bun.sh/) (only for building/development)
- Jira Cloud account with Tempo Timesheets installed
- Tempo API key

## Tool Version Management

We recommend using [mise](https://mise.jdx.dev/getting-started.html) for managing your development tool versions. If you have mise installed, you can:

```bash
mise install
```

This will automatically install the correct versions of Bun and other dependencies specified in the project's `mise.toml` file.

If you encounter issues with your current Bun version, consider using mise to ensure compatibility with the project.

## Installation

### From npm (Recommended)

```bash
npm install -g tempo-tracker
```

Now you can run the CLI directly:
```bash
tempo <command>
```

### From Source

1. Clone the repository:
```bash
git clone https://github.com/NRodriguezcuellar/tempo-tracker-cli.git
cd tempo-tracker-cli
```

2. Install dependencies:
```bash
bun install
```

3. Build the project:
```bash
bun build-target
```

4. Install globally:
```bash
npm install -g .
```

## Quick Setup

Use the interactive setup command to configure your environment:

```bash
tempo setup
```

Or configure manually:

```bash
# Set Tempo API key
tempo config set-api-key YOUR_API_KEY

# Set Jira account ID
tempo config set-jira-account-id YOUR_JIRA_ACCOUNT_ID

# Verify settings
tempo config show
```

### Finding Your Credentials

- **Tempo API Key**: Jira Settings → Apps → Tempo → API Keys
- **Jira Account ID**: Found in your Jira profile URL or via the Jira API

## Usage

### Basic Commands

```bash
# Start tracking time on current branch
tempo start --issue PROJECT-123 --description "Working on feature"

# Check current tracking status
tempo status

# Stop tracking
tempo stop

# Sync tracked time with Tempo
tempo sync --date 2025-03-23
```

### Managing Logs

```bash
# List recent tracking logs
tempo logs list

# Show all logs
tempo logs list --all

# Filter logs by branch
tempo logs list --branch feature/add-reporting

# Filter logs by issue
tempo logs list --issue PROJECT-123

# Filter logs by date
tempo logs list --date 2025-03-23

# Clear all logs
tempo logs clear
```

### Configuration

```bash
# View current configuration
tempo config show

# Update Tempo API key
tempo config set-api-key NEW_API_KEY

# Update Jira account ID
tempo config set-jira-account-id NEW_ACCOUNT_ID
```

## How It Works

The CLI tracks your time by:

1. Recording when you start working on a Git branch
2. Monitoring your active branch and repository
3. Sending activity pulses to Tempo every 5 minutes
4. Creating detailed local logs of your work sessions
5. Syncing work logs with Tempo when requested

### Automatic Safeguards

- Auto-stops tracking after 8 hours of continuous activity
- Detects branch changes and updates tracking accordingly
- Securely stores your credentials locally

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication failed | Verify your API key with `tempo config show` |
| No suggestions in Tempo | Check your Tempo API key permissions |
| Tracking not working | Ensure you're in a Git repository |
| Sync errors | Check your internet connection and Tempo API status |

## Development

```bash
# Build the project (requires Bun)
bun build-target

# Test a command
node dist/index.js <command>
# or
bun run dist <command>
```

## Publishing

The project includes a streamlined publishing workflow for npm releases:

```bash
# Run the publish script (interactive)
./scripts/publish.sh
```

This script will:
1. Check for uncommitted changes
2. Run tests (if available)
3. Build the project
4. Bump the version (patch, minor, major, or custom)
5. Publish to npm
6. Create a git tag and push changes

### Manual Publishing

If you prefer to publish manually:

```bash
# Build the project
npm run build

# Bump version (patch, minor, major)
npm version [patch|minor|major]

# Publish to npm
npm publish
```

## Project Structure

- `/src`: Source code
  - `/commands`: Command implementations
  - `/config`: Configuration management
  - `/api`: Tempo API client
  - `/git`: Git integration utilities
- `/scripts`: Utility scripts for development and publishing
- `/dist`: Compiled output (generated during build)

## License

MIT
