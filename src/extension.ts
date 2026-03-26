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
];

async function showJumpPicker(
  indexService: SymbolIndexService,
  mode: SearchMode,
  title: string,
  placeholder: string,
): Promise<void> {
  const quickPick = vscode.window.createQuickPick<SymbolQuickPickItem>();

  quickPick.title = title;
  quickPick.placeholder = placeholder;
  quickPick.matchOnDescription = false;
  quickPick.matchOnDetail = true;
  quickPick.busy = true;

  const refreshItems = () => {
    quickPick.items = createQuickPickItems(indexService.getSymbols(), mode);
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
    const item = quickPick.selectedItems[0];

    if (!item) {
      return;
    }

    quickPick.hide();
    void openIndexedSymbol(item.symbol);
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
