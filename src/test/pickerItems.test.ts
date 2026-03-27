import assert from "node:assert";
import vscode from "vscode";
import { createQuickPickItems } from "../pickerItems";
import type { IndexedSymbol } from "../types";

function symbol(
  name: string,
  kind: "function" | "component" | "hook",
  path: string,
  line: number,
): IndexedSymbol {
  return {
    name,
    kind,
    path,
    uri: vscode.Uri.file(`/tmp/${path}`),
    range: new vscode.Range(line, 0, line, name.length),
  };
}

suite("createQuickPickItems", () => {
  const symbols: IndexedSymbol[] = [
    symbol("greetUser", "function", "src/utils/greetings.ts", 2),
    symbol("InputField", "component", "src/components/InputField.tsx", 5),
    symbol("Button", "component", "src/components/Button.tsx", 1),
    symbol("useTheme", "hook", "src/hooks/useTheme.ts", 0),
  ];

  test("includes all kinds for all mode", () => {
    const items = createQuickPickItems(symbols, "all");

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["<Button />", "greetUser()", "<InputField />", "useTheme()"],
    );
  });

  test("filters to components", () => {
    const items = createQuickPickItems(symbols, "component");

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["<Button />", "<InputField />"],
    );
  });

  test("filters to functions", () => {
    const items = createQuickPickItems(symbols, "function");

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["greetUser()"],
    );
  });

  test("filters to hooks", () => {
    const items = createQuickPickItems(symbols, "hook");

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["useTheme()"],
    );
  });

  test("detail field includes path and 1-based line number", () => {
    const items = createQuickPickItems(
      [symbol("greetUser", "function", "src/utils/greetings.ts", 2)],
      "all",
    );

    assert.strictEqual(items[0].detail, "src/utils/greetings.ts:3");
  });

  test("description is capitalized kind", () => {
    const items = createQuickPickItems(symbols, "all");
    const kinds = items.map((item) => item.description);

    assert.deepStrictEqual(kinds, [
      "Component",
      "Function",
      "Component",
      "Hook",
    ]);
  });

  test("returns empty array when no symbols match mode", () => {
    const items = createQuickPickItems(
      [symbol("greetUser", "function", "src/utils/greetings.ts", 0)],
      "hook",
    );

    assert.strictEqual(items.length, 0);
  });
});
