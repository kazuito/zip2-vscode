import * as path from "node:path";
import * as vscode from "vscode";
import { extractSymbolsFromText, isSupportedFilePath } from "./symbols";
import type { IndexedSymbol } from "./types";

const INDEX_GLOB = "**/*.{js,jsx,ts,tsx}";
const INDEX_EXCLUDE_GLOB = "**/{node_modules,dist,build,.next,out,coverage}/**";
const EXCLUDE_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
]);
const DOCUMENT_UPDATE_DEBOUNCE_MS = 200;

function isFileUri(uri: vscode.Uri): boolean {
  return uri.scheme === "file";
}

function isIgnoredPath(filePath: string): boolean {
  return filePath
    .split(path.sep)
    .some((segment) => EXCLUDE_SEGMENTS.has(segment));
}

function isIndexableUri(uri: vscode.Uri): boolean {
  return (
    isFileUri(uri) &&
    isSupportedFilePath(uri.fsPath) &&
    !isIgnoredPath(uri.fsPath)
  );
}

async function readUriText(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder("utf-8").decode(bytes);
}

function isFileMissing(error: unknown): boolean {
  return (
    error instanceof vscode.FileSystemError && error.code === "FileNotFound"
  );
}

export class SymbolIndexService implements vscode.Disposable {
  private readonly symbolsByUri = new Map<string, readonly IndexedSymbol[]>();
  private readonly pendingDocumentUpdates = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private initializationPromise: Promise<void> | undefined;
  private initialized = false;
  private snapshot: readonly IndexedSymbol[] = [];
  private disposed = false;

  readonly onDidChangeIndex = this.changeEmitter.event;

  constructor() {
    const watcher = vscode.workspace.createFileSystemWatcher(INDEX_GLOB);

    watcher.onDidCreate((uri) => {
      void this.reindexFromDisk(uri);
    });
    watcher.onDidChange((uri) => {
      void this.reindexFromDisk(uri);
    });
    watcher.onDidDelete((uri) => {
      this.removeUri(uri);
    });

    this.disposables.push(
      watcher,
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.scheduleDocumentUpdate(event.document);
      }),
      vscode.workspace.onDidOpenTextDocument((document) => {
        this.scheduleDocumentUpdate(document);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.clearPendingUpdate(document.uri);
        void this.reindexFromDisk(document.uri);
      }),
    );
  }

  private readonly disposables: vscode.Disposable[] = [];

  dispose(): void {
    this.disposed = true;

    for (const timeout of this.pendingDocumentUpdates.values()) {
      clearTimeout(timeout);
    }

    this.pendingDocumentUpdates.clear();
    this.changeEmitter.dispose();

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  getSymbols(): readonly IndexedSymbol[] {
    return this.snapshot;
  }

  isReady(): boolean {
    return this.initialized;
  }

  ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.buildInitialIndex()
        .catch((error) => {
          console.error(
            "Zip2 failed to build the initial symbol index.",
            error,
          );
          throw error;
        })
        .finally(() => {
          this.initialized = true;
        });
    }

    return this.initializationPromise;
  }

  private async buildInitialIndex(): Promise<void> {
    const openDocuments = new Map<string, vscode.TextDocument>();

    for (const document of vscode.workspace.textDocuments) {
      if (isIndexableUri(document.uri)) {
        openDocuments.set(document.uri.toString(), document);
      }
    }

    const discoveredUris = await vscode.workspace.findFiles(
      INDEX_GLOB,
      INDEX_EXCLUDE_GLOB,
    );
    const uniqueUris = new Map<string, vscode.Uri>();

    for (const uri of discoveredUris) {
      if (isIndexableUri(uri)) {
        uniqueUris.set(uri.toString(), uri);
      }
    }

    for (const document of openDocuments.values()) {
      uniqueUris.set(document.uri.toString(), document.uri);
    }

    await Promise.all(
      [...uniqueUris.values()].map(async (uri) => {
        const openDocument = openDocuments.get(uri.toString());

        if (openDocument) {
          this.updateUriSymbols(uri, openDocument.getText(), false);
          return;
        }

        try {
          const text = await readUriText(uri);
          this.updateUriSymbols(uri, text, false);
        } catch (error) {
          if (!isFileMissing(error)) {
            console.error(`Zip2 failed to index ${uri.fsPath}.`, error);
          }
        }
      }),
    );

    this.rebuildSnapshot(true);
  }

  private scheduleDocumentUpdate(document: vscode.TextDocument): void {
    if (!isIndexableUri(document.uri)) {
      return;
    }

    const key = document.uri.toString();
    this.clearPendingUpdate(document.uri);

    const timeout = setTimeout(() => {
      this.pendingDocumentUpdates.delete(key);
      this.updateUriSymbols(document.uri, document.getText(), true);
    }, DOCUMENT_UPDATE_DEBOUNCE_MS);

    this.pendingDocumentUpdates.set(key, timeout);
  }

  private clearPendingUpdate(uri: vscode.Uri): void {
    const key = uri.toString();
    const timeout = this.pendingDocumentUpdates.get(key);

    if (!timeout) {
      return;
    }

    clearTimeout(timeout);
    this.pendingDocumentUpdates.delete(key);
  }

  private async reindexFromDisk(uri: vscode.Uri): Promise<void> {
    if (!isIndexableUri(uri)) {
      this.removeUri(uri);
      return;
    }

    const openDocument = vscode.workspace.textDocuments.find(
      (document) => document.uri.toString() === uri.toString(),
    );

    if (openDocument) {
      this.updateUriSymbols(uri, openDocument.getText(), true);
      return;
    }

    try {
      const text = await readUriText(uri);
      this.updateUriSymbols(uri, text, true);
    } catch (error) {
      if (isFileMissing(error)) {
        this.removeUri(uri);
        return;
      }

      console.error(`Zip2 failed to reindex ${uri.fsPath}.`, error);
    }
  }

  private removeUri(uri: vscode.Uri): void {
    const didDelete = this.symbolsByUri.delete(uri.toString());

    if (didDelete) {
      this.rebuildSnapshot(true);
    }
  }

  private updateUriSymbols(
    uri: vscode.Uri,
    text: string,
    emitChange: boolean,
  ): void {
    if (this.disposed) {
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const symbols = extractSymbolsFromText(uri, relativePath, text);
    this.symbolsByUri.set(uri.toString(), symbols);
    this.rebuildSnapshot(emitChange);
  }

  private rebuildSnapshot(emitChange: boolean): void {
    this.snapshot = [...this.symbolsByUri.values()].flat();

    if (emitChange) {
      this.changeEmitter.fire();
    }
  }
}
