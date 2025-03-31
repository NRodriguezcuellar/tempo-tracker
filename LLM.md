# System Prompt for Tempo CLI Project

## Project Architecture

- **Runtime Environment**: Node.js with Bun as package manager and build tool
- **Language**: TypeScript
- **Build Target**: Node.js compatibility (avoid Bun-specific APIs)
- **Build Command**: `bun build-target`
- **Test Command**: `bun run dist <command>`

## Project Goal

Create a CLI tool for tracking time spent on git branches and syncing with Tempo API.

## Layered Architecture

The project follows a layered architecture with clear separation of concerns:

1. **Core Layer** (`src/core/`): Contains pure business logic with no dependencies on CLI or daemon:
   - `src/core/tempo.ts`: Tempo API interactions
   - `src/core/git.ts`: Git operations
   - `src/core/worklog.ts`: Worklog handling
   - `src/core/tracking.ts`: Core tracking logic
   - `src/core/index.ts`: Exports all core functionality

2. **Config Layer** (`src/config/`): Handles configuration management independent of any frontend:
   - `src/config/index.ts`: Configuration schema, storage, and activity log

3. **Backend Layer** (`src/backend/`): HTTP server that exposes core functionality:
   - `src/backend/server.ts`: HTTP server implementation with API routes

4. **Daemon Layer** (`src/daemon/`): Process management, separate from HTTP server:
   - `src/daemon/index.ts`: Daemon lifecycle (start, stop, status)

5. **Client Layer** (`src/client/`): Client library for communicating with the backend:
   - `src/client/index.ts`: Client implementation for any frontend

6. **CLI Layer** (`src/cli/`): Command-line interface using the client:
   - `src/cli/commands.ts`: Command implementations
   - `src/cli/index.ts`: Main CLI entry point

7. **Utils Layer** (`src/utils/`): Shared utility functions:
   - `src/utils/format.ts`: Formatting utilities

## Utils Layer Functionality

- **Format Utilities** (`src/utils/format.ts`): Formatting helpers for dates, durations, etc.
- **Debug Utilities** (`src/utils/debug.ts`): Component-specific debug logging that activates only when the DEBUG environment variable is set to "true"
  - Usage: `const debugLog = createDebugLogger("component-name"); debugLog("message");`
  - Example: `DEBUG=true tempo daemon start` will show detailed daemon logs
  - Uses chalk for color highlighting: debug tag in gray, timestamp in blue, component name in cyan
  - Color scheme: `[DEBUG][timestamp][component] message`

## Core Dependencies

- **commander**: CLI framework for command structure
- **conf**: Configuration management for storing settings
- **zod**: Schema validation for type safety
- **axios**: HTTP client for API requests
- **chalk**: Terminal styling for better UX
- **inquirer**: Interactive prompts for user input
- **simple-git**: Git operations library

## Code Standards

- Use TypeScript for all code files
- Follow functional programming patterns where possible
- Implement proper error handling with informative messages
- Use async/await for asynchronous operations
- Implement proper logging for debugging
- Write code that is testable and maintainable
- Include trailing commas in function signatures and parameter lists

## Tempo API Integration

- Base URL: `https://api.eu.tempo.io/4`
- Reference the documentation in `docs/tempo.txt` for all API endpoints
- Implement proper authentication handling
- Use typed request/response interfaces
- Handle rate limiting and API errors gracefully

## Git Integration

- Use simple-git library for Git operations
- Implement proper error handling for git operations
- Track time spent on branches accurately

## Performance Considerations

- Minimize dependencies and bundle size
- Optimize API calls to reduce latency
- Cache frequently used data when appropriate
- Use efficient data structures for time tracking

## Development Guidelines

- Maintain backward compatibility
- Document all public APIs and functions
- Follow semantic versioning for releases
- Write unit tests for critical functionality
- Use meaningful variable and function names
- Keep functions small and focused on a single responsibility

## Prohibited Patterns

- DO NOT use Bun-specific APIs that won't work in Node.js
- DO NOT place files outside their designated directories
- DO NOT use deprecated or experimental APIs
- DO NOT implement features without proper error handling
- DO NOT hardcode sensitive information (API keys, tokens)
- DO NOT use any libraries not listed in dependencies
- DO NOT modify the build configuration without explicit instruction
- DO NOT implement features into `/prototypes`

## Required Behavior

- ALWAYS validate user input
- ALWAYS provide helpful error messages
- ALWAYS follow the existing code patterns
- ALWAYS implement proper type checking
- ALWAYS handle edge cases
- ALWAYS provide clear documentation
- ALWAYS respect the project structure
- ALWAYS ensure daemon is running for client operations

## Testing

- Test all commands with `bun build-target && bun run dist <command>`
- Verify compatibility with Node.js environment
- Test error handling scenarios
- Test with various git branch scenarios
- Test API integration thoroughly
- Test daemon functionality and client-daemon communication

## Memory Creation Guidelines

- CREATE MEMORIES when you discover key code organization patterns (e.g., command structure, file organization)
- CREATE MEMORIES when you learn about project-specific naming conventions
- CREATE MEMORIES when you identify error handling patterns used in the codebase
- CREATE MEMORIES when you understand the configuration system and data structures
- CREATE MEMORIES when you discover important architectural decisions
- CREATE MEMORIES when you learn about command implementation patterns
- CREATE MEMORIES when you identify utility function organization and usage
- CREATE MEMORIES when you understand the API integration approach
- CREATE MEMORIES when you discover testing patterns and requirements
- CREATE MEMORIES when you learn about user workflow and experience design
- CREATE MEMORIES for any recurring patterns that would be useful for future development
- CREATE MEMORIES for any non-obvious implementation details
- CREATE MEMORIES for performance optimization techniques used in the project
- CREATE MEMORIES for backward compatibility considerations
- CREATE MEMORIES for any project-specific conventions not explicitly documented elsewhere

## Memory Usage Guidelines

- REFERENCE MEMORIES when implementing new features to maintain consistency
- REFERENCE MEMORIES when making architectural decisions
- REFERENCE MEMORIES when suggesting code improvements
- REFERENCE MEMORIES when debugging issues to understand expected behavior
- REFERENCE MEMORIES when explaining code patterns to users
- PRIORITIZE memory-based knowledge over general assumptions about code organization

## Doc references

- Bun documentation: <https://bun.sh/llms.txt>
 
## Global Installation Considerations

- When installed globally via npm, the backend script path resolution must handle different directory structures
- The `getBackendScriptPath()` function in `src/daemon/index.ts` must check multiple possible locations:
  - Same directory as the current script
  - Parent directory of the current script
  - Dist directory relative to the current script
  - Project root directory
- Use the first path where the backend script exists
- Implement proper logging for path resolution to aid debugging
