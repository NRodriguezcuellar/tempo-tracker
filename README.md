# Tempo CLI - Git Branch Time Tracker

Track time spent on Git branches and sync with Tempo Timesheets

## Features
- Automatic time tracking per Git branch
- Tempo API authentication
- Automatic Tempo suggestions via Pulse API
- Daily time syncing with Tempo
- Auto-stop tracking after 8 hours
- Secure credential storage

## Prerequisites
- Bun runtime
- Jira Cloud account with Tempo Timesheets installed
- Tempo API key

## Installation
```bash
bun install
```

## Configuration

Set up required credentials:
```bash
# Set API key
tempo-tracker config set-api-key YOUR_API_KEY

# Set Jira account ID
tempo-tracker config set-jira-account-id YOUR_JIRA_ACCOUNT_ID

# Verify settings
tempo-tracker config show
```

## Setup
1. Get your Tempo API key from:
   Jira Settings → Apps → Tempo → API Keys

## Usage
```bash
# Start tracking time on current branch
tempo-tracker start --issue PROJECT-123 --description "Working on feature"

# Stop tracking
tempo-tracker stop

# Sync with Tempo (for explicit worklog creation)
tempo-tracker sync --date 2024-03-18

# Check current status
tempo-tracker status
```

## Automatic Time Tracking
The CLI will:
1. Track time spent on the current Git branch
2. Send pulses to Tempo for timesheet suggestions every 5 minutes
3. Auto-stop tracking after 8 hours of continuous activity
4. Detect branch changes and update tracking accordingly

## Environment Configuration
The tool uses the following configuration:
```
TEMPO_BASE_URL=https://api.eu.tempo.io/4
```

This is configured automatically but can be customized if needed.

## Pulse Feature
The CLI now includes an automatic pulse feature that:
- Sends activity data to Tempo every 5 minutes while tracking
- Creates suggestions in your Tempo timesheet without explicit syncing
- Uses your current branch name and issue ID for suggestions
- Automatically stops after 8 hours to prevent forgotten tracking sessions

## Troubleshooting
Common issues:
- `Authentication failed` - Check your API key with `tempo-tracker config show`
- `No suggestions appearing` - Check your Tempo API key permissions
- `Tracking not working` - Ensure you're in a Git repository

## Development
```bash
bun run build  # Compile TypeScript
bun run test   # Run test suite
```

## License
MIT
