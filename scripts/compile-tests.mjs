import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync(new URL("../out", import.meta.url), {
  force: true,
  recursive: true,
});

const result = spawnSync("pnpm", ["exec", "tsc", "--outDir", "out"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
