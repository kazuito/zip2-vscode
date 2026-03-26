import * as vscode from "vscode";
import { openIndexedSymbol } from "./navigation";
import type { SymbolQuickPickItem } from "./pickerItems";
import { createQuickPickItems } from "./pickerItems";
import { SymbolIndexService } from "./symbolIndexService";
import type { SearchMode } from "./types";

const COMMANDS: ReadonlyArray<{
  readonly id: string;
  readonly mode: SearchMode;
  readonly title: string;
  readonly placeholder: string;
}> = [
  {
    id: "zip2.searchSymbols",
    mode: "all",
    title: "Zip2: Search Components and Functions",
    placeholder: "Search components and functions",
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

  const buildItems = (): (SymbolQuickPickItem | vscode.QuickPickItem)[] => {
    const allItems = createQuickPickItems(indexService.getSymbols(), mode);
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

  const indexChangeDisposable = indexService.onDidChangeIndex(() => {
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
    const item = quickPick.selectedItems[0] as SymbolQuickPickItem | undefined;

    if (!item || !("symbol" in item)) {
      return;
    }

    quickPick.hide();

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

    void openIndexedSymbol(item.symbol);
  });

  let peekTimeout: ReturnType<typeof setTimeout> | undefined;

  quickPick.onDidChangeActive((activeItems) => {
    if (peekTimeout !== undefined) {
      clearTimeout(peekTimeout);
    }
    peekTimeout = setTimeout(() => {
      peekTimeout = undefined;
      const active = activeItems[0] as SymbolQuickPickItem | undefined;
      if (!active || !("symbol" in active)) {
        return;
      }
      void vscode.workspace
        .openTextDocument(active.symbol.uri)
        .then((doc) =>
          vscode.window.showTextDocument(doc, {
            preview: true,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Active,
          }),
        )
        .then((editor) => {
          editor.revealRange(
            active.symbol.range,
            vscode.TextEditorRevealType.InCenterIfOutsideViewport,
          );
        });
    }, 300);
  });

  quickPick.onDidHide(() => {
    if (peekTimeout !== undefined) {
      clearTimeout(peekTimeout);
      peekTimeout = undefined;
    }
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
