# Tempo CLI Daemon Prototype

This directory contains a prototype implementation of a background daemon service for the Tempo CLI. The daemon allows tracking to persist across terminal sessions and directories, addressing key limitations of the current CLI implementation.

## Purpose

The daemon addresses several key issues with the current CLI:

1. **Persistent Tracking**: Tracking continues even when terminal sessions are closed
2. **Cross-Directory Support**: Tracking can be managed across multiple git repositories
3. **Centralized Management**: All tracking is managed by a single daemon process
4. **Idle Detection**: Automatic detection and handling of long tracking sessions
5. **Notifications**: Desktop notifications for important events

## Implementation Details

### Core Components

- **Daemon Process**: Background process managed by PM2
- **IPC Mechanism**: Inter-process communication between CLI and daemon
- **State Management**: Centralized state storage for tracking sessions
- **Notifications**: Desktop notifications for important events

### Files

- `index.ts`: Entry point for CLI integration
- `service.ts`: Core daemon service implementation
- `state.ts`: State management for the daemon
- `ipc.ts`: IPC implementation for daemon-CLI communication
- `ipc-client.ts`: Client-side utilities for CLI commands
- `daemon-process.ts`: Main daemon process implementation
- `notifications.ts`: User notification system

## Usage

The daemon adds new commands to the CLI:

```bash
# Start the daemon
tempo daemon start

# Stop the daemon
tempo daemon stop

# Check daemon status
tempo daemon status
```

When the daemon is running, the regular CLI commands (`start`, `stop`, `status`, `sync`) will communicate with the daemon instead of managing tracking directly.

## Integration with Main CLI

To integrate this prototype with the main CLI:

1. Add the daemon commands to the main CLI
2. Modify the existing commands to use the daemon when available
3. Add daemon status information to the status command

## Limitations

As a prototype, this implementation has some limitations:

1. **IPC Mechanism**: The IPC implementation is simplified and would need a more robust implementation for production
2. **Error Handling**: Error handling is basic and would need improvement
3. **Security**: No authentication mechanism for the IPC communication
4. **Testing**: No tests are included in this prototype

## Future Improvements

- **Robust IPC**: Implement a more robust IPC mechanism with proper error handling
- **Authentication**: Add authentication to prevent unauthorized access
- **Multi-User Support**: Support multiple users on the same system
- **Activity Detection**: More sophisticated idle detection based on user activity
- **Web Interface**: Simple web interface for monitoring and managing tracking
- **Reporting**: Advanced reporting across multiple repositories
