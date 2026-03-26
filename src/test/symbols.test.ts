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

  test("extracts components wrapped with memo", () => {
    const source = `
      import { memo } from 'react';
      export const MemoCard = memo(() => <div />);
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/MemoCard.tsx"),
      "src/MemoCard.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [["MemoCard", "component"]],
    );
  });

  test("extracts components wrapped with forwardRef", () => {
    const source = `
      import { forwardRef } from 'react';
      export const FancyInput = forwardRef((props, ref) => <input ref={ref} />);
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/FancyInput.tsx"),
      "src/FancyInput.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [["FancyInput", "component"]],
    );
  });

  test("extracts components wrapped with React.memo", () => {
    const source = `
      export const StatusBadge = React.memo(() => <span />);
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/StatusBadge.tsx"),
      "src/StatusBadge.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [["StatusBadge", "component"]],
    );
  });

  test("extracts components wrapped with memo(forwardRef(...))", () => {
    const source = `
      export const Field = memo(forwardRef((props, ref) => <input ref={ref} />));
    `;

    const symbols = extractSymbolsFromText(
      vscode.Uri.file("/workspace/src/Field.tsx"),
      "src/Field.tsx",
      source,
    );

    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [["Field", "component"]],
    );
  });

  test("keeps lowercase memo-wrapped functions as functions", () => {
    const source = `
      const input = memo(() => <input />);
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
});
