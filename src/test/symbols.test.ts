import * as assert from "node:assert";
import * as vscode from "vscode";
import { extractSymbolsFromText } from "../symbols";

suite("extractSymbolsFromText", () => {
  test("extracts top-level functions and components", () => {
    const source = `
      export function greetUser() {
        return "hello";
      }

      export const Input = () => <input />;

      const helper = function helperImpl() {
        return true;
      };

      function outer() {
        function nested() {
          return "nope";
        }

        return nested();
      }

      class Example {
        method() {
          return 1;
        }
      }
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/example.tsx"),
      "src/example.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [
        ["greetUser", "function"],
        ["Input", "component"],
        ["helper", "function"],
        ["outer", "function"],
      ],
    );
  });

  test("keeps lowercase jsx functions as functions", () => {
    const source = `
      const input = () => <input />;
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/input.tsx"),
      "src/input.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [["input", "function"]],
    );
  });

  test("supports exported default named functions", () => {
    const source = `
      export default function GreetingCard() {
        return <section />;
      }
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/GreetingCard.tsx"),
      "src/GreetingCard.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [["GreetingCard", "component"]],
    );
  });
});
