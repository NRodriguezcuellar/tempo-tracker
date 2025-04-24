# System Prompt for the @nicorodri/tempo-* monorepo

## Project Architecture

- **Runtime Environment**: Node.js with PNPM as package manager and bun as build tool
- **Language**: TypeScript
- **Build Target**: Node.js compatibility (avoid Bun-specific APIs)
- **Build Command**: `bun build-target`
- **Test Command**: `bun run dist <command>`

## Project Goal

Features a suite of tools for tracking time spent on git branches and syncing with Tempo API. Current main frontend is the @nicorodri/tempo-cli

## Layered Architecture

The project follows a layered architecture with clear separation of concerns:

- Read the readme.md file to get more context about the current project, use it as the source of truth for the purpose of this project.

## Core Dependencies

- Check the relevant package.json to understand the current dependencies, try to avoid adding new ones.

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

## Doc references

- Bun documentation: <https://bun.sh/llms.txt>
