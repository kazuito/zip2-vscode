import vscode from "vscode";
import { getComponentLabelFormat, getFunctionLabelFormat, getHookLabelFormat } from "./config";
import type { IndexedSymbol, SearchMode } from "./types";

export interface SymbolQuickPickItem extends vscode.QuickPickItem {
  readonly symbol: IndexedSymbol;
}

function compareSymbols(left: IndexedSymbol, right: IndexedSymbol): number {
  const nameOrder = left.name.localeCompare(right.name);

  if (nameOrder !== 0) {
    return nameOrder;
  }

  const pathOrder = left.path.localeCompare(right.path);

  if (pathOrder !== 0) {
    return pathOrder;
  }

  return left.range.start.line - right.range.start.line;
}

export function createQuickPickItems(
  symbols: readonly IndexedSymbol[],
  mode: SearchMode,
): SymbolQuickPickItem[] {
  const filteredSymbols =
    mode === "all"
      ? [...symbols]
      : symbols.filter((symbol) => symbol.kind === mode);

  filteredSymbols.sort(compareSymbols);

  const formats = {
    function: getFunctionLabelFormat(),
    component: getComponentLabelFormat(),
    hook: getHookLabelFormat(),
  };

  return filteredSymbols.map((symbol) => {
    const label = formats[symbol.kind].replace("${name}", symbol.name);
    return {
      label,
      description: symbol.kind.charAt(0).toUpperCase() + symbol.kind.slice(1),
      detail: `${symbol.path}:${symbol.range.start.line + 1}`,
      symbol,
    };
  });
}
