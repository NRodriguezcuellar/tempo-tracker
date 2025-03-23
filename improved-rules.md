# System Prompt for Tempo CLI Project

## Project Architecture
- **Runtime Environment**: Node.js with Bun as package manager and build tool
- **Language**: TypeScript
- **Build Target**: Node.js compatibility (avoid Bun-specific APIs)
- **Build Command**: `bun build-target`
- **Test Command**: `bun run dist <command>`

## Project Goal
Create a CLI tool for tracking time spent on git branches and syncing with Tempo API.

## Project Structure
- `/src`: Source code directory
  - `/commands`: CLI command implementations
  - `/config`: Configuration management
  - `/api`: API client implementations
  - `index.ts`: Main entry point / CLI code
  - `prototypes`: Prototype ideas, don't place code here

## Core Dependencies
- **commander**: CLI framework for command structure
- **conf**: Configuration management for storing settings
- **zod**: Schema validation for type safety
- **axios**: HTTP client for API requests
- **chalk**: Terminal styling for better UX
- **inquirer**: Interactive prompts for user input

## Code Standards
- Use TypeScript for all code files
- Follow functional programming patterns where possible
- Implement proper error handling with informative messages
- Use async/await for asynchronous operations
- Implement proper logging for debugging
- Write code that is testable and maintainable

## Tempo API Integration
- Base URL: `https://api.eu.tempo.io/4`
- Reference the documentation in `docs/tempo.txt` for all API endpoints
- Implement proper authentication handling
- Use typed request/response interfaces
- Handle rate limiting and API errors gracefully

## Git Integration
- Use native git commands via child processes
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

## Testing
- Test all commands with `bun build-target &&bun dist <command>`
- Verify compatibility with Node.js environment
- Test error handling scenarios
- Test with various git branch scenarios
- Test API integration thoroughly

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
