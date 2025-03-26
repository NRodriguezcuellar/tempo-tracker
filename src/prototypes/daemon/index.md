# Tempo CLI Daemon Implementation Plan

## Current Issues

What is currently really annoying is that when you start tracking, you can never close the terminal if you don't want your pulses to be stopped. But of course the active tracker stays active even if you close the terminal. So if you forget about it, you'll have a huge tracked period in which you probably did nothing or did something else. Also if you switch to a different folder you will have to stop the tracker and start it again in the new folder.

With mise it is also annoying that every node install is different so you can't just install the cli app and use it everywhere. You have to install it globally in every folder you want to use it.

## Solution: System-Level Background Service

The most straightforward approach that addresses our core issues is implementing a lightweight system-level background service.

### Implementation Plan

#### 1. Core Daemon Service

- **Technology**: Node.js background process using PM2 or similar process manager
- **Responsibilities**:
  - Maintain tracking state across terminal sessions
  - Handle timing logic independent of CLI
  - Manage configuration from a central location
  - Detect idle periods and provide notifications

#### 2. Inter-Process Communication (IPC)

- **Technology**: Named pipes or Unix sockets for local communication
- **Implementation**:
  - Create a simple message format for commands/responses
  - Include authentication to prevent unauthorized access
  - Implement reconnection logic for reliability

#### 3. Global CLI Installation

- **Approach**: Create a global npm package with service management
- **Commands**:
  - `tempo daemon start` - Start background service
  - `tempo daemon stop` - Stop background service
  - `tempo daemon status` - Check service status
  - Regular commands that communicate with daemon

#### 4. Cross-Directory Support

- **Git Integration**:
  - Daemon detects git repositories across filesystem
  - Tracks current branch in each repository
  - Handles directory changes automatically

#### 5. Data Persistence

- **Storage**: Central JSON-based storage using the existing config system
- **State Management**:
  - Track active sessions across multiple repositories
  - Persist activity logs in a central location
  - Handle crashes and restarts gracefully

### Project Structure

```typescript
src/
  daemon/
    index.ts         # Daemon entry point
    service.ts       # Core service logic
    ipc.ts           # IPC implementation
    state.ts         # State management
    notifications.ts # User notifications
  commands/
    daemon.ts        # Daemon management commands
  utils/
    ipc-client.ts    # Client-side IPC utilities
```

### Implementation Phases

#### Phase 1: Basic Daemon

- Implement daemon process with PM2 integration
- Create IPC mechanism between CLI and daemon
- Add daemon management commands

#### Phase 2: State Management

- Implement central state storage
- Handle tracking across terminal sessions
- Add basic idle detection

#### Phase 3: Multi-Directory Support

- Add git repository detection
- Implement branch tracking across directories
- Handle directory changes

#### Phase 4: Usability Improvements

- Add notifications for long tracking sessions
- Create simple status indicators
- Implement reporting across repositories

### Alternative Approaches

- **Git Hooks**: Could supplement this approach but not replace it
- **File Watchers**: May be added for more accurate activity tracking
