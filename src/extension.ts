import * as vscode from "vscode";
import { openIndexedSymbol } from "./navigation";
import type { SymbolQuickPickItem } from "./pickerItems";
import { createQuickPickItems } from "./pickerItems";
import { SymbolIndexService } from "./symbolIndexService";
import type { SearchMode } from "./types";

const OPEN_BESIDE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon("split-horizontal"),
  tooltip: "Open to the Side",
};

function isSymbolQuickPickItem(
  item: vscode.QuickPickItem,
): item is SymbolQuickPickItem {
  return "symbol" in item;
}

const COMMANDS: ReadonlyArray<{
  readonly id: string;
  readonly mode: SearchMode;
  readonly title: string;
  readonly placeholder: string;
}> = [
  {
    id: "zip2.searchSymbols",
    mode: "all",
    title: "Zip2: Search Symbols",
    placeholder: "Search components, functions and hooks",
  },
  {
    id: "zip2.searchComponents",
    mode: "component",
    title: "Zip2: Search Components",
    placeholder: "Search components",
  },
  {
    id: "zip2.searchFunctions",
    mode: "function",
    title: "Zip2: Search Functions",
    placeholder: "Search functions",
  },
  {
    id: "zip2.searchHooks",
    mode: "hook",
    title: "Zip2: Search Hooks",
    placeholder: "Search hooks",
  },
];

async function showJumpPicker(
  context: vscode.ExtensionContext,
  indexService: SymbolIndexService,
  mode: SearchMode,
  title: string,
  placeholder: string,
): Promise<void> {
  const RECENT_KEY = "zip2.recentSymbols";
  type RecentEntry = { name: string; path: string };

  const quickPick = vscode.window.createQuickPick<
    SymbolQuickPickItem | vscode.QuickPickItem
  >();

  quickPick.title = title;
  quickPick.placeholder = placeholder;
  quickPick.matchOnDescription = false;
  quickPick.matchOnDetail = true;
  quickPick.busy = true;

  let cachedBaseItems: SymbolQuickPickItem[] | undefined;

  const getBaseItems = (): SymbolQuickPickItem[] => {
    if (!cachedBaseItems) {
      cachedBaseItems = createQuickPickItems(indexService.getSymbols(), mode).map(
        (item) => ({ ...item, buttons: [OPEN_BESIDE_BUTTON] }),
      );
    }
    return cachedBaseItems;
  };

  const buildItems = (): (SymbolQuickPickItem | vscode.QuickPickItem)[] => {
    const allItems = getBaseItems();
    const recents = context.workspaceState.get<RecentEntry[]>(RECENT_KEY, []);
    const recentItems: SymbolQuickPickItem[] = [];
    for (const entry of recents) {
      const match = allItems.find(
        (item) =>
          item.symbol.name === entry.name && item.symbol.path === entry.path,
      );
      if (match) {
        recentItems.push(match);
      }
    }
    if (recentItems.length === 0) {
      return allItems;
    }
    const recentPaths = new Set(
      recentItems.map((item) => `${item.symbol.name}::${item.symbol.path}`),
    );
    const restItems = allItems.filter(
      (item) => !recentPaths.has(`${item.symbol.name}::${item.symbol.path}`),
    );
    return [
      { label: "Recently Visited", kind: vscode.QuickPickItemKind.Separator },
      ...recentItems,
      { label: "", kind: vscode.QuickPickItemKind.Separator },
      ...restItems,
    ];
  };

  const refreshItems = () => {
    quickPick.items = buildItems();
  };

  const navigateToItem = (
    item: SymbolQuickPickItem,
    viewColumn?: vscode.ViewColumn,
  ): void => {
    const recents = context.workspaceState.get<RecentEntry[]>(RECENT_KEY, []);
    const entry: RecentEntry = {
      name: item.symbol.name,
      path: item.symbol.path,
    };
    const updated = [
      entry,
      ...recents.filter(
        (r) => !(r.name === entry.name && r.path === entry.path),
      ),
    ].slice(0, 5);
    void context.workspaceState.update(RECENT_KEY, updated);
    void openIndexedSymbol(item.symbol, viewColumn);
  };

  const indexChangeDisposable = indexService.onDidChangeIndex(() => {
    cachedBaseItems = undefined;
    refreshItems();
  });

  const finishInitialization = indexService
    .ensureInitialized()
    .catch(async (error) => {
      console.error("Zip2 failed to initialize.", error);
      await vscode.window.showErrorMessage(
        "Zip2 failed to build its symbol index. Check the developer console for details.",
      );
    })
    .finally(() => {
      quickPick.busy = false;
      refreshItems();
    });

  quickPick.onDidAccept(() => {
    const item = quickPick.selectedItems[0];
    if (!item || !isSymbolQuickPickItem(item)) {
      return;
    }
    quickPick.hide();
    navigateToItem(item);
  });

  quickPick.onDidTriggerItemButton((event) => {
    if (!isSymbolQuickPickItem(event.item)) {
      return;
    }
    quickPick.hide();
    navigateToItem(event.item, vscode.ViewColumn.Beside);
  });

  quickPick.onDidHide(() => {
    indexChangeDisposable.dispose();
    quickPick.dispose();
  });

  refreshItems();
  quickPick.show();

  await finishInitialization;
}

export function activate(context: vscode.ExtensionContext): void {
  const indexService = new SymbolIndexService();
  context.subscriptions.push(indexService);

  void indexService.ensureInitialized();

  for (const command of COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.id, async () => {
        await showJumpPicker(
          context,
          indexService,
          command.mode,
          command.title,
          command.placeholder,
        );
      }),
    );
  }
}

export function deactivate(): void {}
