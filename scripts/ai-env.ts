/**
 * Shared setup for the AI scripts (precompute, evals, check:models): load .env.local without
 * overriding the shell, and force the in-memory store so scripts never write demo sessions to InsForge.
 * Run with `tsx --conditions=react-server` so `server-only` imports resolve.
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnv({ memoryStore = true } = {}) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  if (memoryStore) {
    delete process.env.INSFORGE_BASE_URL;
    delete process.env.INSFORGE_SERVICE_KEY;
  }
  process.env.REPLAY_INSTANT = "1";
}

export function requireKey(what: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${what} needs ANTHROPIC_API_KEY (in .env.local or the shell). Nothing was run.`);
    process.exit(2);
  }
}

export const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : null;
};
export const flag = (name: string) => process.argv.includes(`--${name}`);
