# Zip2

Zip2 adds workspace symbol pickers for `.js`, `.jsx`, `.ts`, and `.tsx` files.

Commands:

- `Search Symbols` — search all components, functions, and hooks
- `Search Components` — React-style components (PascalCase + JSX)
- `Search Functions`
- `Search Hooks` — functions matching `use[A-Z]*`

## Features

- **Icons** — codicons in the picker distinguish components (`$(symbol-class)`), functions (`$(symbol-function)`), and hooks (`$(symbol-event)`)
- **Peek** — highlights the active item's location in the editor as you navigate the list
- **Recently visited** — last 5 accepted symbols appear at the top of every picker
- **Configurable excludes** — add extra glob patterns via `zip2.excludePatterns` in settings (e.g. `["**/generated/**"]`)
