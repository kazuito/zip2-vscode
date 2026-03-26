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
const INITIAL_INDEX_CONCURRENCY = 6;

interface SnapshotSegment {
  readonly offset: number;
  readonly length: number;
}

function isFileUri(uri: vscode.Uri): boolean {
  return uri.scheme === "file";
}

function buildExcludeGlob(): string {
  const user = vscode.workspace
    .getConfiguration("zip2")
    .get<string[]>("excludePatterns", []);
  if (user.length === 0) return INDEX_EXCLUDE_GLOB;
  return `{${INDEX_EXCLUDE_GLOB},${user.join(",")}}`;
}

function isIgnoredPath(filePath: string): boolean {
  const segments = filePath.split(path.sep);
  if (segments.some((seg) => EXCLUDE_SEGMENTS.has(seg))) return true;
  const userPatterns = vscode.workspace
    .getConfiguration("zip2")
    .get<string[]>("excludePatterns", []);
  for (const pattern of userPatterns) {
    const match = /^\*\*\/([^/*]+)\/\*\*$/.exec(pattern);
    if (match && segments.includes(match[1])) return true;
  }
  return false;
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

function areSymbolsEqual(
  left: readonly IndexedSymbol[],
  right: readonly IndexedSymbol[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftSymbol = left[index];
    const rightSymbol = right[index];

    if (
      leftSymbol.name !== rightSymbol.name ||
      leftSymbol.kind !== rightSymbol.kind ||
      leftSymbol.path !== rightSymbol.path ||
      leftSymbol.uri.toString() !== rightSymbol.uri.toString() ||
      !leftSymbol.range.isEqual(rightSymbol.range)
    ) {
      return false;
    }
  }

  return true;
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    },
  );

  await Promise.all(workers);
}

export class SymbolIndexService implements vscode.Disposable {
  private readonly symbolsByUri = new Map<string, readonly IndexedSymbol[]>();
  private readonly snapshotSegments = new Map<string, SnapshotSegment>();
  private readonly pendingDocumentUpdates = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private initializationPromise: Promise<void> | undefined;
  private initialized = false;
  private snapshot: IndexedSymbol[] = [];
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
      buildExcludeGlob(),
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

    await runWithConcurrency(
      [...uniqueUris.values()],
      INITIAL_INDEX_CONCURRENCY,
      async (uri) => {
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
      },
    );
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
    const key = uri.toString();
    const didDelete = this.symbolsByUri.delete(key);

    if (!didDelete) {
      return;
    }

    this.removeSnapshotSegment(key);
    this.changeEmitter.fire();
  }

  private updateUriSymbols(
    uri: vscode.Uri,
    text: string,
    emitChange: boolean,
  ): boolean {
    if (this.disposed) {
      return false;
    }

    const key = uri.toString();
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const symbols = extractSymbolsFromText(uri, relativePath, text);
    const previousSymbols = this.symbolsByUri.get(key) ?? [];

    if (areSymbolsEqual(previousSymbols, symbols)) {
      return false;
    }

    this.symbolsByUri.set(key, symbols);
    this.replaceSnapshotSegment(key, symbols);

    if (emitChange) {
      this.changeEmitter.fire();
    }

    return true;
  }

  private removeSnapshotSegment(key: string): void {
    const segment = this.snapshotSegments.get(key);

    if (!segment) {
      return;
    }

    this.snapshot.splice(segment.offset, segment.length);
    this.snapshotSegments.delete(key);
    this.shiftSegmentsAfter(segment.offset, -segment.length);
  }

  private replaceSnapshotSegment(
    key: string,
    symbols: readonly IndexedSymbol[],
  ): void {
    const previousSegment = this.snapshotSegments.get(key);
    const offset = previousSegment?.offset ?? this.snapshot.length;
    const previousLength = previousSegment?.length ?? 0;
    const nextLength = symbols.length;

    this.snapshot.splice(offset, previousLength, ...symbols);

    if (nextLength === 0) {
      this.snapshotSegments.delete(key);
    } else {
      this.snapshotSegments.set(key, {
        offset,
        length: nextLength,
      });
    }

    this.shiftSegmentsAfter(offset, nextLength - previousLength, key);
  }

  private shiftSegmentsAfter(
    offset: number,
    delta: number,
    currentKey?: string,
  ): void {
    if (delta === 0) {
      return;
    }

    for (const [key, segment] of this.snapshotSegments) {
      if (key === currentKey || segment.offset <= offset) {
        continue;
      }

      this.snapshotSegments.set(key, {
        offset: segment.offset + delta,
        length: segment.length,
      });
    }
  }
}
