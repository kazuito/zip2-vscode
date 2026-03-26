import * as vscode from "vscode";
import type { IndexedSymbol } from "./types";

export async function openIndexedSymbol(
  symbol: IndexedSymbol,
  viewColumn?: vscode.ViewColumn,
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(symbol.uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn,
  });

  editor.selection = new vscode.Selection(
    symbol.range.start,
    symbol.range.start,
  );
  editor.revealRange(
    symbol.range,
    vscode.TextEditorRevealType.InCenterIfOutsideViewport,
  );
}
