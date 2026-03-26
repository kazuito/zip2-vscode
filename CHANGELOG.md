# Change Log

All notable changes to the "zip2" extension will be documented in this file.

## [0.0.1] - 2026-03-27

### Added

- `Search Symbols` command — search all functions, components, and hooks in one picker
- `Search Components` command — React-style components (PascalCase + JSX)
- `Search Functions` command
- `Search Hooks` command — functions matching `use[A-Z]*`
- HOC-aware indexing: components wrapped with `memo`, `forwardRef`, `React.memo`, or `React.forwardRef` (including nested combinations) are indexed and classified correctly
- Open to the Side button on every picker item to open in a split editor
- Recently visited symbols — last 5 accepted symbols appear at the top of every picker
- Configurable label formats via `zip2.functionLabelFormat`, `zip2.componentLabelFormat`, and `zip2.hookLabelFormat` (use `${name}` as the placeholder)
- Configurable exclude patterns via `zip2.excludePatterns`
