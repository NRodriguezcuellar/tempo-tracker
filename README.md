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
- 🔄 Background tracking via daemon process
- 🧩 Modular monorepo architecture

## Project Structure

This project uses a monorepo structure with Bun workspaces:

```
/packages/core/     # Core business logic, config, and utils
/apps/backend/     # HTTP server implementation
/apps/cli/         # Command-line interface
/apps/daemon/      # Background tracking daemon process
```

## Prerequisites

- [Node.js](https://nodejs.org/) runtime (for using the CLI)
- [Bun](https://bun.sh/) (for building/development)
- Jira Cloud account with Tempo Timesheets installed
- Tempo API key

## Tool Version Management

We recommend using [mise](https://mise.jdx.dev/getting-started.html) for managing your development tool versions. If you have mise installed, you can:

```bash
mise install
```

This will automatically install the correct versions of Bun and other dependencies specified in the project's `mise.toml` file.

## Installation

### From npm (Recommended)

You can install the package directly from npm:

```bash
npm install -g tempo-tracker
```

Once installed, you can run the CLI directly:

```bash
tempo <command>
```

### From Source

If you want to install from source:

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Build the project:

```bash
bun run build
```

This builds all packages in the monorepo structure.

1. Install globally:

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

### Daemon Management

The Tempo CLI uses a daemon process to track time in the background, allowing tracking to continue across terminal sessions.

```bash
# Start the daemon
tempo daemon start

# Check daemon status
tempo daemon status

# View daemon logs
tempo daemon logs

# Stop the daemon
tempo daemon stop
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

1. Running a daemon process in the background to maintain tracking state
2. Recording when you start working on a Git branch
3. Monitoring your active branch and repository
4. Sending activity pulses to Tempo every 5 minutes
5. Creating detailed local logs of your work sessions
6. Syncing work logs with Tempo when requested

### Automatic Safeguards

- Auto-stops tracking after 8 hours of continuous activity
- Detects branch changes and updates tracking accordingly
- Securely stores your credentials locally
- Maintains tracking state across terminal sessions via daemon

## Architecture

The project uses a monorepo structure with Bun workspaces, organized into a layered architecture:

### Monorepo Structure

```
/packages/
  /core/       # Core business logic, config, utils, and daemon functionality
/apps/
  /backend/    # HTTP server implementation
  /cli/        # Command-line interface
  /daemon/     # Background tracking daemon process
```

### Layered Architecture

1. **Core Layer** (`packages/core/`):
   - Contains pure business logic with no dependencies on UI
   - Includes API clients, Git operations, and tracking logic
   - Also contains config utilities and shared functionality

2. **Backend Layer** (`apps/backend/`):
   - HTTP server that exposes core functionality via REST API
   - Used by the CLI and other potential frontends
   - Implements a simple, robust API for tracking operations

3. **CLI Layer** (`apps/cli/`):
   - Command-line interface using the client to communicate with the backend
   - Implements user-facing commands and error handling

4. **Daemon Layer** (`apps/daemon/`):
   - Standalone background process for persistent time tracking
   - Runs independently from terminal sessions
   - Maintains tracking state across system restarts and user sessions

### Development Workflow

The monorepo uses Bun workspaces for package management and building:

```bash
# Build all packages
bun run build

# Build specific packages
bun --filter=@tempo-tracker/core run build
bun --filter=@tempo-tracker/backend run build
bun --filter=@tempo-tracker/daemon run build
bun --filter=tempo-tracker run build

# Run development servers
bun --filter=@tempo-tracker/backend run dev
bun --filter=@tempo-tracker/daemon run dev
bun --filter=tempo-tracker run dev
```

This architecture allows for:

- Clear separation of concerns
- Potential for alternative frontends (web UI, IDE plugins)
- Better testability of core business logic
- Improved maintainability
- Independent versioning of packages

## Troubleshooting

| Issue                   | Solution                                                |
| ----------------------- | ------------------------------------------------------- |
| Authentication failed   | Verify your API key with `tempo config show`            |
| No suggestions in Tempo | Check your Tempo API key permissions                    |
| Tracking not working    | Ensure you're in a Git repository                       |
| Sync errors             | Check your internet connection and Tempo API status     |
| Daemon not responding   | Check daemon status with `tempo daemon status`          |
| Multiple sessions       | Stop tracking in all repositories with `tempo stop`     |
| Missing logs            | Verify daemon is running with `tempo daemon status`     |

## Development

```bash
# Build all packages (requires Bun)
bun run build

# Test a command
bun apps/cli/dist/index.js <command>

# Build specific packages
bun --filter=@tempo-tracker/core run build
bun --filter=@tempo-tracker/backend run build
bun --filter=@tempo-tracker/daemon run build
bun --filter=tempo-tracker run build
```

## Project Structure

The project follows a monorepo structure with Bun workspaces:

```
/packages/
  /core/            # Core business logic package
    /src/
      /git.ts      # Git operations
      /tempo.ts    # Tempo API client
      /tracking.ts # Tracking logic
      /worklog.ts  # Worklog management
      /config/     # Configuration management
      /utils/      # Utility functions
      /constants.ts # Shared constants
      /index.ts    # Package entry point

/apps/
  /backend/        # Backend server application
    /src/
      /server.ts   # HTTP server implementation
  
  /cli/            # CLI application
    /src/
      /commands.ts # Command implementations
      /client.ts   # Client for backend communication
      /index.ts    # CLI definition
      /main.ts     # Main entry point

  /daemon/         # Daemon application for background tracking
    /src/
      /service.ts  # Daemon service implementation
      /index.ts    # Daemon process entry point
```

Each package has its own `package.json`, `tsconfig.json`, and build configuration.

## License

MIT
