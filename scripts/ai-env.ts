/**
 * Shared setup for the AI scripts (precompute, evals, check:models): load .env.local without
 * overriding the shell, and force the in-memory store so scripts never write demo sessions to InsForge.
 * Run with `tsx --conditions=react-server` so `server-only` imports resolve.
 */
import fs from "node:fs";
import path from "node:path";

let ledgerCreds: { baseUrl: string; apiKey: string } | null = null;

export function loadEnv({ memoryStore = true } = {}) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  if (process.env.INSFORGE_BASE_URL && process.env.INSFORGE_SERVICE_KEY) {
    ledgerCreds = { baseUrl: process.env.INSFORGE_BASE_URL, apiKey: process.env.INSFORGE_SERVICE_KEY };
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

/**
 * The spend ledger for scripts. Demo state stays in memory, but every paid run is written to
 * InsForge `agent_runs` so it counts against AI_TOTAL_BUDGET_USD like a run on the site.
 * Without InsForge credentials there is nothing shared to check, so the scripts say so and carry on.
 */
export async function spendLedger(script: string) {
  const cap = Number(process.env.AI_TOTAL_BUDGET_USD ?? 25);
  const creds = ledgerCreds;
  const db = creds ? (await import("@insforge/sdk")).createAdminClient({ baseUrl: creds.baseUrl, apiKey: creds.apiKey }).database : null;
  if (!db) console.warn(`  No InsForge credentials: ${script} spend is not recorded against the $${cap} total cap.`);
  const errText = (e: unknown) => (e as { message?: string }).message ?? String(e);

  async function total(): Promise<number> {
    if (!db) return 0;
    const res = await db.from("agent_runs").select("est_cost_usd").gt("est_cost_usd", 0).limit(50_000);
    if (res.error) throw new Error(`Could not read spend from InsForge: ${errText(res.error)}`);
    return ((res.data ?? []) as { est_cost_usd: number | string }[]).reduce((s, r) => s + (Number(r.est_cost_usd) || 0), 0);
  }

  /** Exit before spending if the total cap is already reached. */
  async function guard() {
    const spent = await total();
    if (spent >= cap) {
      console.error(`Total AI spend is $${spent.toFixed(2)} of the $${cap} cap (AI_TOTAL_BUDGET_USD). ${script} stopped before spending more.`);
      process.exit(3);
    }
    return spent;
  }

  async function record(flow: string, usd: number, models: string[]) {
    if (!db || !(usd > 0)) return;
    const now = new Date().toISOString();
    const { ulid } = await import("ulid");
    const res = await db.from("agent_runs").insert([
      {
        id: `run_${ulid()}`,
        firm_id: "rypples",
        flow,
        input: { source: script },
        status: "ok",
        started_at: now,
        finished_at: now,
        model: models.join(",") || null,
        est_cost_usd: Math.round(usd * 10000) / 10000,
        mode: "live",
      },
    ]);
    if (res.error) console.warn(`  Could not record $${usd.toFixed(4)} of ${script} spend: ${errText(res.error)}`);
  }

  return { cap, total, guard, record };
}
