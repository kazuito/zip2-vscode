import assert from "node:assert";
import vscode from "vscode";
import { openIndexedSymbol } from "../navigation";
import type { IndexedSymbol } from "../types";

suite("extension", () => {
  test("registers all four search commands", async () => {
    const extension = vscode.extensions.all.find(
      (candidate) => candidate.packageJSON.name === "zip2",
    );

    assert.ok(extension, "expected the zip2 extension to be present");

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("zip2.searchSymbols"));
    assert.ok(commands.includes("zip2.searchComponents"));
    assert.ok(commands.includes("zip2.searchFunctions"));
    assert.ok(commands.includes("zip2.searchHooks"));
  });

  test("opens a symbol location in the active editor column", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "typescriptreact",
      content: "export function greetUser() {\n  return 'hello';\n}\n",
    });
    const range = new vscode.Range(0, 16, 0, 25);
    const sym: IndexedSymbol = {
      name: "greetUser",
      kind: "function",
      uri: document.uri,
      range,
      path: "untitled.tsx",
    };

    await openIndexedSymbol(sym);

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    assert.strictEqual(editor.document.uri.toString(), document.uri.toString());
    assert.ok(
      editor.selection.isEqual(new vscode.Selection(range.start, range.start)),
    );
  });

  test("opens a symbol to the side", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "export function helper() {}\n",
    });
    const range = new vscode.Range(0, 16, 0, 22);
    const sym: IndexedSymbol = {
      name: "helper",
      kind: "function",
      uri: document.uri,
      range,
      path: "helper.ts",
    };

    await openIndexedSymbol(sym, vscode.ViewColumn.Beside);

    const editors = vscode.window.visibleTextEditors;
    const opened = editors.find(
      (e) => e.document.uri.toString() === document.uri.toString(),
    );
    assert.ok(opened, "expected document to be visible in a side column");
  });
});
