import type * as vscode from "vscode";

export type SearchMode = "all" | "function" | "component";

export type IndexedSymbolKind = "function" | "component";

export interface IndexedSymbol {
  readonly name: string;
  readonly kind: IndexedSymbolKind;
  readonly uri: vscode.Uri;
  readonly range: vscode.Range;
  readonly path: string;
}
