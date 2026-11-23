/**
 * Loads data/seed/*.json into InsForge (pnpm db:seed). Validates every file first.
 * `pnpm db:reseed --confirm` truncates the seed tables before loading.
 * Requires INSFORGE_BASE_URL and INSFORGE_SERVICE_KEY (from .env.local).
 */
import fs from "node:fs";
import path from "node:path";
import { createAdminClient } from "@insforge/sdk";
import { SeedFiles } from "../lib/domain/schemas/index.ts";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnv();
  const reseed = process.argv.includes("--reseed");
  if (reseed && !process.argv.includes("--confirm")) throw new Error("db:reseed drops seed rows; pass --confirm");
  const baseUrl = process.env.INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_SERVICE_KEY;
  if (!baseUrl || !apiKey) throw new Error("Set INSFORGE_BASE_URL and INSFORGE_SERVICE_KEY in .env.local");
  const db = createAdminClient({ baseUrl, apiKey }).database;

  for (const [name, schema] of Object.entries(SeedFiles)) {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/seed", `${name}.json`), "utf8"));
    const rows = (schema.parse(raw) as Record<string, unknown>[]).map((r) => ({ firm_id: "rypples", ...r }));
    if (reseed) {
      const del = await db.from(name).delete().neq("id", "__none__");
      if (del.error) throw new Error(`${name}: ${JSON.stringify(del.error)}`);
    }
    for (let i = 0; i < rows.length; i += 200) {
      const res = await db.from(name).upsert(rows.slice(i, i + 200));
      if (res.error) throw new Error(`${name}: ${JSON.stringify(res.error)}`);
    }
    console.log(`${name.padEnd(22)} ${rows.length}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
