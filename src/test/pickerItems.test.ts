import * as assert from "node:assert";
import * as vscode from "vscode";
import { createQuickPickItems } from "../pickerItems";
import type { IndexedSymbol } from "../types";

function symbol(
  name: string,
  kind: "function" | "component",
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
  ];

  test("includes both components and functions for all mode", () => {
    const items = createQuickPickItems(symbols, "all");

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["Button", "greetUser", "InputField"],
    );
  });

  test("filters to components", () => {
    const items = createQuickPickItems(symbols, "component");

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["Button", "InputField"],
    );
  });

  test("filters to functions", () => {
    const items = createQuickPickItems(symbols, "function");

    assert.deepStrictEqual(items.map((item) => item.label), ["greetUser"]);
  });
});
