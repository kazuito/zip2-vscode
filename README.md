# Zip2

**Instant symbol navigation for JS/TS workspaces.**
Jump to any function, React component, or hook — without leaving your keyboard.

## Commands

| Command | Description |
|---|---|
| `Zip2: Search Symbols` | Search functions, components, and hooks together |
| `Zip2: Search Components` | React-style components only |
| `Zip2: Search Functions` | Plain functions only |
| `Zip2: Search Hooks` | `use*` hooks only |

Open the Command Palette (`⇧⌘P`) and type `Zip2` to get started.

## Features

**HOC-aware**
Components wrapped with `memo`, `forwardRef`, `React.memo`, or `React.forwardRef` — including nested combinations — are indexed and classified correctly.

**Open to the Side**
Every picker item has a split-editor button. Open a symbol beside your current file without losing context.

**Recently visited**
Your last 5 accepted symbols float to the top of every picker, so you can bounce between locations fast.

**Configurable labels**
Control how each symbol kind is displayed.

```jsonc
// settings.json
"zip2.functionLabelFormat": "${name}()",   // default
"zip2.componentLabelFormat": "<${name} />", // default
"zip2.hookLabelFormat": "${name}()"        // default
```

**Exclude patterns**
Skip generated or irrelevant directories.

```jsonc
"zip2.excludePatterns": ["**/generated/**", "**/.turbo/**"]
```

## Supported Files

`.js` · `.jsx` · `.ts` · `.tsx`

## License

MIT
