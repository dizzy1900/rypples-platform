/**
 * Storage for everything that is written at runtime: the event log, AI bookkeeping,
 * the shared any-company cache and Captain threads. Seed rows are immutable and are
 * read from data/seed (the same rows `pnpm db:seed` loads into InsForge).
 *
 * Two implementations behind one interface:
 *  - InsForge (Postgres) when INSFORGE_BASE_URL + INSFORGE_SERVICE_KEY are set;
 *  - in-memory (process global) otherwise, for local dev, tests and offline demos.
 */
import type { DemoEvent } from "./events";

export type AgentRun = {
  id: string;
  firm_id: string;
  flow: string;
  input: unknown;
  status: "running" | "ok" | "error" | "fallback";
  started_at: string;
  finished_at: string | null;
  model: string | null;
  prompt_version: string | null;
  usage: unknown;
  searches: number;
  fetches: number;
  est_cost_usd: number;
  mode: "live" | "cached" | "precomputed";
  session_id: string | null;
  ip_hash: string | null;
  error: string | null;
};

export type AnyCompanyRun = {
  id: string;
  domain: string;
  display_name: string;
  status: "ok" | "declined" | "insufficient" | "ambiguous" | "not_found";
  result: unknown;
  run_id: string | null;
  created_at: string;
};

export type CaptainMessage = {
  id: string;
  session_id: string;
  viewer_kind: "rypples" | "founder";
  company_id: string | null;
  role: "user" | "assistant";
  content: unknown;
  run_id: string | null;
  created_at: string;
};

export interface Store {
  readonly kind: "memory" | "insforge";
  appendEvent(e: DemoEvent): Promise<void>;
  listEvents(sessionId: string): Promise<DemoEvent[]>;
  putAgentRun(r: AgentRun): Promise<void>;
  listAgentRuns(limit: number): Promise<AgentRun[]>;
  /** Sum of est_cost_usd across every recorded run: the lifetime spend the total cap is checked against. */
  totalAgentSpend(): Promise<number>;
  getAnyCompanyRun(key: { id?: string; domain?: string }): Promise<AnyCompanyRun | null>;
  putAnyCompanyRun(r: AnyCompanyRun): Promise<void>;
  listAnyCompanyRuns(limit: number): Promise<AnyCompanyRun[]>;
  appendCaptainMessage(m: CaptainMessage): Promise<void>;
  listCaptainMessages(sessionId: string, viewerKind: string, companyId: string | null, limit: number): Promise<CaptainMessage[]>;
  clearCaptainThread(sessionId: string, viewerKind: string, companyId: string | null): Promise<void>;
}

// ── In-memory implementation ────────────────────────────────────────────
type Mem = {
  events: DemoEvent[];
  runs: AgentRun[];
  anyCompany: Map<string, AnyCompanyRun>;
  captain: CaptainMessage[];
};
const g = globalThis as unknown as { __rypplesMem?: Mem };
const mem = (): Mem =>
  (g.__rypplesMem ??= { events: [], runs: [], anyCompany: new Map(), captain: [] });

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  async appendEvent(e: DemoEvent) {
    mem().events.push(e);
  }
  async listEvents(sessionId: string) {
    return mem()
      .events.filter((e) => e.session_id === sessionId)
      .sort((a, b) => a.at.localeCompare(b.at));
  }
  async putAgentRun(r: AgentRun) {
    const runs = mem().runs;
    const i = runs.findIndex((x) => x.id === r.id);
    if (i >= 0) runs[i] = r;
    else runs.push(r);
  }
  async listAgentRuns(limit: number) {
    return [...mem().runs].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
  }
  async totalAgentSpend() {
    return mem().runs.reduce((sum, r) => sum + (Number(r.est_cost_usd) || 0), 0);
  }
  async getAnyCompanyRun(key: { id?: string; domain?: string }) {
    for (const r of mem().anyCompany.values()) {
      if (key.id && r.id === key.id) return r;
      if (key.domain && r.domain === key.domain) return r;
    }
    return null;
  }
  async putAnyCompanyRun(r: AnyCompanyRun) {
    mem().anyCompany.set(r.domain, r);
  }
  async listAnyCompanyRuns(limit: number) {
    return [...mem().anyCompany.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }
  async appendCaptainMessage(m: CaptainMessage) {
    mem().captain.push(m);
  }
  async listCaptainMessages(sessionId: string, viewerKind: string, companyId: string | null, limit: number) {
    return mem()
      .captain.filter((m) => m.session_id === sessionId && m.viewer_kind === viewerKind && m.company_id === companyId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-limit);
  }
  async clearCaptainThread(sessionId: string, viewerKind: string, companyId: string | null) {
    const m = mem();
    m.captain = m.captain.filter(
      (x) => !(x.session_id === sessionId && x.viewer_kind === viewerKind && x.company_id === companyId),
    );
  }
}

/** Reset the in-memory store (tests only). */
export function __resetMemoryStore() {
  g.__rypplesMem = undefined;
}
