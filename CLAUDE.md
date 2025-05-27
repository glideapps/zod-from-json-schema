# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# zod-from-json-schema Development Guidelines

## Commands
- **Build**: `npm run build` (generates CJS and ESM outputs)
- **Test all**: `npm test` (runs with coverage)
- **Test single file**: `npx vitest run src/path/to/file.test.ts`
- **Test with pattern**: `npx vitest run -t "test pattern"`
- **Run specific test**: `npx vitest run src/index.test.ts -t "should extract properties"`
- **Clean**: `npm run clean` (removes dist directory)
- **Prepare for publishing**: `npm run prepublishOnly`

## Code Style
- **TypeScript**: Use strict types with proper JSON Schema interface typing
- **Imports**: Use named imports (`import { z } from "zod/v4"`)
- **Formatting**: 4-space indentation, prefer lines under 80 chars
- **Functions**: Pure functions with no side effects, descriptive names in camelCase
- **Types/Interfaces**: Use PascalCase, export types used in public API
- **Error handling**: Use Zod's built-in validation rather than throwing errors
- **Documentation**: JSDoc comments for all exported functions and types

## Architecture
- Maintain dual module support (CJS/ESM) for all exports
- Keep conversion logic modular with single-responsibility functions
- Write tests for each feature and edge cases, achieving 100% line and branch coverage
- Never go back on supported features!  If something works, it has to keep working.
- Target ES2018 for maximum compatibility (Node 10+)
- Use esbuild for bundling with optimized output
- Follow semantic versioning for releases

For release process, see RELEASE.md
