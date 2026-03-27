import path from "node:path";
import ts from "typescript";
import vscode from "vscode";
import type { IndexedSymbol, IndexedSymbolKind } from "./types";

const SUPPORTED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function getScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  if (filePath.endsWith(".ts")) {
    return ts.ScriptKind.TS;
  }

  return ts.ScriptKind.JS;
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

const COMPONENT_WRAPPERS = new Set(["memo", "forwardRef"]);

function unwrapHocCallable(
  node: ts.Expression,
): ts.FunctionExpression | ts.ArrowFunction | undefined {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return node;
  }

  if (ts.isCallExpression(node) && node.arguments.length > 0) {
    const callee = node.expression;
    const isKnownWrapper =
      (ts.isIdentifier(callee) && COMPONENT_WRAPPERS.has(callee.text)) ||
      (ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "React" &&
        COMPONENT_WRAPPERS.has(callee.name.text));

    if (isKnownWrapper) {
      return unwrapHocCallable(node.arguments[0]);
    }
  }

  return undefined;
}

function hasJsxEvidence(node: ts.Node | undefined): boolean {
  if (!node) {
    return false;
  }

  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return true;
  }

  let foundJsx = false;

  ts.forEachChild(node, (child) => {
    if (!foundJsx && hasJsxEvidence(child)) {
      foundJsx = true;
    }
  });

  return foundJsx;
}

function toRange(sourceFile: ts.SourceFile, node: ts.Node): vscode.Range {
  const start = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return new vscode.Range(start.line, start.character, end.line, end.character);
}

function classifySymbol(
  name: string,
  callable: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
): IndexedSymbolKind {
  if (/^use[A-Z]/.test(name)) {
    return "hook";
  }

  if (isPascalCase(name) && hasJsxEvidence(callable.body)) {
    return "component";
  }

  return "function";
}

function createSymbol(
  sourceFile: ts.SourceFile,
  uri: vscode.Uri,
  relativePath: string,
  name: string,
  nameNode: ts.Node,
  callable: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
): IndexedSymbol {
  const kind = classifySymbol(name, callable);

  return {
    name,
    kind,
    uri,
    range: toRange(sourceFile, nameNode),
    path: relativePath,
  };
}

function extractFromFunctionDeclaration(
  sourceFile: ts.SourceFile,
  uri: vscode.Uri,
  relativePath: string,
  statement: ts.FunctionDeclaration,
): IndexedSymbol[] {
  if (!statement.name) {
    return [];
  }

  return [
    createSymbol(
      sourceFile,
      uri,
      relativePath,
      statement.name.text,
      statement.name,
      statement,
    ),
  ];
}

function extractFromVariableStatement(
  sourceFile: ts.SourceFile,
  uri: vscode.Uri,
  relativePath: string,
  statement: ts.VariableStatement,
): IndexedSymbol[] {
  const symbols: IndexedSymbol[] = [];

  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
      continue;
    }

    const callable = unwrapHocCallable(declaration.initializer);
    if (!callable) {
      continue;
    }

    symbols.push(
      createSymbol(
        sourceFile,
        uri,
        relativePath,
        declaration.name.text,
        declaration.name,
        callable,
      ),
    );
  }

  return symbols;
}

export function isSupportedFilePath(filePath: string): boolean {
  if (filePath.endsWith(".d.ts")) {
    return false;
  }

  return SUPPORTED_EXTENSIONS.has(path.extname(filePath));
}

export function extractSymbolsFromText(
  uri: vscode.Uri,
  relativePath: string,
  text: string,
): IndexedSymbol[] {
  if (!isSupportedFilePath(uri.fsPath)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    uri.fsPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(uri.fsPath),
  );

  const symbols: IndexedSymbol[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      symbols.push(
        ...extractFromFunctionDeclaration(
          sourceFile,
          uri,
          relativePath,
          statement,
        ),
      );
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      symbols.push(
        ...extractFromVariableStatement(
          sourceFile,
          uri,
          relativePath,
          statement,
        ),
      );
    }
  }

  return symbols;
}
