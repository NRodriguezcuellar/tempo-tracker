# Tempo CLI - Git Branch Time Tracker

Track time spent on Git branches and sync with Tempo Timesheets

## Features
- Automatic time tracking per Git branch
- Jira/Tempo OAuth2 authentication
- Daily time syncing with Tempo
- Interactive setup wizard
- Secure credential storage

## Prerequisites
- Node.js 18+
- Bun runtime
- Jira Cloud account with Tempo Timesheets installed
- Admin permissions to create OAuth applications in Jira

## Installation
```bash
bun install
```

## Configuration

Set up required credentials:
```bash
# Set API key
tempo-tracker config api-key YOUR_API_KEY

# Configure Jira instance
tempo-tracker config jira-instance https://your-domain.atlassian.net

# Verify settings
tempo-tracker config show
```

## Setup
1. Get your Tempo API key from:
   Jira Settings → Apps → Tempo → API Keys

## Usage
```bash
# Start tracking time on current branch
tempo-tracker start --issue PROJECT-123

# Stop tracking
tempo-tracker stop

# Sync with Tempo
tempo-tracker sync-tempo --date 2024-03-18

# Check current status
tempo-tracker status
```

## Automatic Time Tracking
The CLI will:
1. Detect new Git branch creation
2. Match branch names to Jira issue keys (e.g., `feature/PROJECT-123`)
3. Prompt for time entry descriptions
4. Auto-pause during IDE inactivity

## Environment Configuration
```env
# .env
JIRA_INSTANCE=https://your-domain.atlassian.net
TEMPO_BASE_URL=https://api.eu.tempo.io/4
```

## Troubleshooting
Common issues:
- `Authentication failed` - Re-run `tempo-tracker auth`
- `Missing scopes` - Update OAuth app permissions in Jira
- `Sync conflicts` - Use `--force` flag to overwrite Tempo entries

## Development
```bash
bun run build  # Compile TypeScript
bun run test   # Run test suite
```

## License
MIT
