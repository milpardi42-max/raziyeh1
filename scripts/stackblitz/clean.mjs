import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Delete build caches only, never data/, uploads/, .env files or the lockfile.
for (const path of ["../../.next", "../../dist/.next"]) {
  const dir = fileURLToPath(new URL(path, import.meta.url));
  await rm(dir, { recursive: true, force: true });
  console.log(`Removed generated Next cache: ${dir}`);
}
