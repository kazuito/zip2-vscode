import * as assert from "node:assert";
import * as vscode from "vscode";
import { openIndexedSymbol } from "../navigation";
import type { IndexedSymbol } from "../types";

suite("extension", () => {
  test("registers the search commands", async () => {
    const extension = vscode.extensions.all.find(
      (candidate) => candidate.packageJSON.name === "zip2",
    );

    assert.ok(extension, "expected the zip2 extension to be present");

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("zip2.searchSymbols"));
    assert.ok(commands.includes("zip2.searchComponents"));
    assert.ok(commands.includes("zip2.searchFunctions"));
  });

  test("opens a symbol location in the editor", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "typescriptreact",
      content: "export function greetUser() {\n  return 'hello';\n}\n",
    });
    const range = new vscode.Range(0, 16, 0, 25);
    const symbol: IndexedSymbol = {
      name: "greetUser",
      kind: "function",
      uri: document.uri,
      range,
      path: "untitled.tsx",
    };

    await openIndexedSymbol(symbol);

    const editor = vscode.window.activeTextEditor;

    assert.ok(editor);
    assert.strictEqual(editor.document.uri.toString(), document.uri.toString());
    assert.ok(
      editor.selection.isEqual(new vscode.Selection(range.start, range.start)),
    );
  });
});
