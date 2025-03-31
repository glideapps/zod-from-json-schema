# zod-from-json-schema Development Guidelines

## Commands
- **Build:** `npm run build` (generates CJS and ESM outputs)
- **Test all:** `npm test`
- **Test single file:** `npx vitest run src/path/to/file.test.ts`
- **Test with pattern:** `npx vitest run -t "test pattern"`
- **Clean:** `npm run clean` (removes dist directory)

## Code Style
- **TypeScript:** Use strict types, avoid `any` except in JSON Schema interfaces
- **Imports:** Use named imports from zod (`import { z } from "zod"`)
- **Formatting:** 4-space indentation, avoid lines > 80 chars
- **Naming:** Use camelCase for functions/variables, PascalCase for types/interfaces
- **Error handling:** Use Zod's built-in validation or custom refinements
- **Comments:** Document functions with JSDoc comments including params, return types
- **Compatibility:** Keep dual-module support (CJS/ESM) for all exported functions

## Architecture
- Functions should be pure with no side effects
- Keep JSON Schema to Zod conversion logic separate from utility functions
- Write tests for each supported feature and edge case