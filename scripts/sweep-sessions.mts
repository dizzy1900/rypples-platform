/** Manual housekeeping: delete session-scoped events and Captain messages older than 7 days (pnpm sweep:sessions). */
import fs from "node:fs";
import path from "node:path";
import { createAdminClient } from "@insforge/sdk";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
const db = createAdminClient({ baseUrl: process.env.INSFORGE_BASE_URL!, apiKey: process.env.INSFORGE_SERVICE_KEY! }).database;
const a = await db.from("events").delete().not("session_id", "is", null).lt("at", cutoff);
const b = await db.from("captain_messages").delete().lt("created_at", cutoff);
if (a.error || b.error) {
  console.error(a.error ?? b.error);
  process.exit(1);
}
console.log(`Swept session rows older than ${cutoff}`);
