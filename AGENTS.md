# Zip2

- VS Code extension for searching workspace functions and React-style function components in `.js`, `.jsx`, `.ts`, and `.tsx` files.
- Use Context7 MCP when you need library/API documentation, code generation, setup steps, or configuration details.

## Repo Map

- `src/extension.ts`: command registration and Quick Pick entrypoints.
- `src/symbolIndexService.ts`: background in-memory indexing, file watching, and incremental updates.
- `src/symbols.ts`: TypeScript AST parsing and function/component classification.
- `src/pickerItems.ts`: transforms indexed symbols into Quick Pick items.
- `src/navigation.ts`: opens the target location in the editor.
- `src/test/`: VS Code extension-host tests.
- `scripts/compile-tests.mjs`: clears `out/` and compiles tests before `pnpm test`.
- `dist/`: bundled extension output from Rolldown.
- `out/`: compiled test output; generated.

## Commands

```bash
pnpm bundle
pnpm watch
pnpm lint
pnpm typecheck
pnpm test
```

## Workflow Expectations

- Inspect `package.json` and the relevant file under `src/` before changing commands, build steps, or extension behavior.
- Run `pnpm typecheck` after code changes. Run `pnpm test` when behavior, indexing, navigation, or command wiring changes.
- Use `pnpm lint` for non-mutating lint verification.
- Be careful with `pnpm check`: it runs `biome check --write --unsafe`, so it can rewrite files.

## Codebase Rules

- Keep the extension JS/TS-only unless the repo is explicitly broadened; supported file detection lives in `src/symbols.ts`.
- Keep indexing lightweight: avoid full TypeScript programs/typechecking inside the indexer; this repo intentionally uses `ts.createSourceFile(...)`.
- Do not edit `dist/` or `out/` manually. Regenerate them through the provided scripts.
- If you change command ids or titles, update both `src/extension.ts` and `package.json`.
- Always keep this AGENTS.md (or CLAUDE.md = symlink) up to date as codebase evolve.

## Safety / Gotchas

- `pnpm test` uses the VS Code extension host via `vscode-test` and reads tests from `out/test/**/*.test.js`.
- The extension activates on `onStartupFinished`, so startup-cost changes in `src/symbolIndexService.ts` matter.
