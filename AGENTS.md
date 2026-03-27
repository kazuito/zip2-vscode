# Zip2

- VS Code extension for searching workspace functions, React-style components, and React hooks in `.js`, `.jsx`, `.ts`, and `.tsx` files.
- Use Context7 MCP when you need library/API documentation, code generation, setup steps, or configuration details.

## Repo Map

- `src/extension.ts`: command registration and Quick Pick entrypoints.
- `src/symbolIndexService.ts`: background in-memory indexing, file watching, and incremental updates.
- `src/symbols.ts`: TypeScript AST parsing and function/component/hook classification.
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

- Use default imports (`import vscode from "vscode"`) over namespace imports (`import * as vscode from "vscode"`). `module: "Node16"` enables `esModuleInterop` so default imports work for all packages used here.
- Keep the extension JS/TS-only unless the repo is explicitly broadened; supported file detection lives in `src/symbols.ts`.
- Keep indexing lightweight: avoid full TypeScript programs/typechecking inside the indexer; this repo intentionally uses `ts.createSourceFile(...)`.
- Do not edit `dist/` or `out/` manually. Regenerate them through the provided scripts.
- If you change command ids or titles, update both `src/extension.ts` and `package.json`.
- Recently visited symbols are persisted in `workspaceState` under the key `zip2.recentSymbols` as `{ name, path }` pairs (max 5).
- User-configurable exclude globs live in the `zip2.excludePatterns` setting; applied in both `findFiles` and the watcher path filter in `src/symbolIndexService.ts`.
- `.gitignore` respect is controlled by `zip2.respectGitignore` (boolean, default `true`). When enabled, `loadGitignoreFilters()` in `src/symbolIndexService.ts` finds all `**/.gitignore` files at startup and builds `GitignoreFilter[]` entries (using the `ignore` npm package). The filters are checked in `isIgnoredPath()` and cover both the initial `findFiles` scan and all watcher events. Takes effect on the next reload.
- HOC unwrapping (`memo`, `forwardRef`, `React.memo`, `React.forwardRef`) is handled in `src/symbols.ts` via `unwrapHocCallable`. Add new wrappers to `COMPONENT_WRAPPERS` there.
- Label formats for each symbol kind are user-configurable via `zip2.{function,component,hook}LabelFormat` settings; `${name}` is the placeholder. Applied in `src/pickerItems.ts`.
- Picker item sort+map result is cached per picker session in `extension.ts` (`cachedBaseItems`); cleared on `onDidChangeIndex`. Don't call `createQuickPickItems` directly in `buildItems` — go through `getBaseItems()`.
- Each picker item has an "Open to the Side" button (`OPEN_BESIDE_BUTTON`). Button clicks are handled via `quickPick.onDidTriggerItemButton` → `navigateToItem(item, ViewColumn.Beside)`.
- `openIndexedSymbol` in `src/navigation.ts` accepts an optional `viewColumn`; omit for active column, pass `ViewColumn.Beside` for split.
- **Always keep this AGENTS.md up to date as codebase evolve.** You must update AGENTS.md even if you are'nt instructed to do. If you are Claude, update CLAUDE.md instead.

## Safety / Gotchas

- `pnpm test` uses the VS Code extension host via `vscode-test` and reads tests from `out/test/**/*.test.js`.
- The extension activates on `onStartupFinished`, so startup-cost changes in `src/symbolIndexService.ts` matter.
