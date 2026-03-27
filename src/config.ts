import vscode from "vscode";

function get<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration("zip2").get<T>(key, defaultValue);
}

export function getExcludePatterns(): string[] {
  return get<string[]>("excludePatterns", []);
}

export function getRespectGitignore(): boolean {
  return get<boolean>("respectGitignore", true);
}

export function getFunctionLabelFormat(): string {
  return get<string>("functionLabelFormat", "${name}()");
}

export function getComponentLabelFormat(): string {
  return get<string>("componentLabelFormat", "<${name} />");
}

export function getHookLabelFormat(): string {
  return get<string>("hookLabelFormat", "${name}()");
}

export function getRecentSymbolsCount(): number {
  return get<number>("recentSymbolsCount", 5);
}
