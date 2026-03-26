# Zip2

Zip2 adds workspace symbol pickers for `.js`, `.jsx`, `.ts`, and `.tsx` files.

Commands:

- `Search Symbols` — search all components, functions, and hooks
- `Search Components` — React-style components (PascalCase + JSX)
- `Search Functions`
- `Search Hooks` — functions matching `use[A-Z]*`

## Features

- **HOC-aware indexing** — components wrapped with `memo`, `forwardRef`, `React.memo`, or `React.forwardRef` (including nested combinations) are indexed and classified correctly
- **Open to the Side** — every picker item has a split-editor button to open the symbol beside the current editor
- **Recently visited** — last 5 accepted symbols appear at the top of every picker
- **Configurable labels** — control how each kind is displayed via `zip2.functionLabelFormat`, `zip2.componentLabelFormat`, and `zip2.hookLabelFormat` (use `${name}` as the placeholder)
- **Configurable excludes** — add extra glob patterns via `zip2.excludePatterns` in settings (e.g. `["**/generated/**"]`)
