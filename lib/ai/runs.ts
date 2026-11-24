/**
 * Server-side reads for S5b: the shared any-company cache (docs/07-ai.md F2).
 * Runs are shared across sessions; only `reviewed` precomputed files or real cached runs are shown.
 */
import "server-only";
import { getStore } from "@/lib/data";
import type { AnyCompanyResult, RecentRun } from "./types";
import { budgetStatus } from "./budget";
import { hasPriority } from "@/lib/session";

export const F2_FRESH_MS = 7 * 24 * 3600_000;

export async function getRun(runId: string): Promise<AnyCompanyResult | null> {
  const row = await getStore().getAnyCompanyRun({ id: runId });
  if (row) return row.result as AnyCompanyResult;
  // the stored row id is the run id; also accept the inner run_id
  const recent = await getStore().listAnyCompanyRuns(200);
  const hit = recent.find((r) => (r.result as AnyCompanyResult | null)?.run_id === runId || r.run_id === runId);
  return hit ? (hit.result as AnyCompanyResult) : null;
}

export async function recentRuns(limit = 6): Promise<RecentRun[]> {
  const rows = await getStore().listAnyCompanyRuns(50);
  const out: RecentRun[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const res = r.result as AnyCompanyResult | null;
    if (!res || r.status === "ambiguous" || r.status === "not_found") continue;
    // one run is stored under each of its lookup keys; list it once
    if (seen.has(res.run_id)) continue;
    seen.add(res.run_id);
    out.push({ run_id: res.run_id, name: res.identity.name || r.display_name, website: res.identity.website, status: res.status, created_at: r.created_at });
    if (out.length >= limit) break;
  }
  return out;
}

/** Mode for the S5b input page and whether "Run again" is allowed (soft limit at 80%). */
export async function f2Availability() {
  const st = await budgetStatus({ priority: await hasPriority() });
  return { mode: st.mode.mode, runAgainAllowed: st.runAgainAllowed };
}
