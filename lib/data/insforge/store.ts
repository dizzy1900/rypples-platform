/**
 * InsForge (Postgres) implementation of the runtime Store, via @insforge/sdk on the server only.
 * Tables are created by db/migrations/*.sql.
 */
import "server-only";
import { createAdminClient } from "@insforge/sdk";
import type { DemoEvent } from "../events";
import type { AgentRun, AnyCompanyRun, CaptainMessage, Store } from "../store";
import { env } from "@/lib/env";

type Client = ReturnType<typeof createAdminClient>;
let client: Client | null = null;
function db() {
  if (!client) {
    const e = env();
    client = createAdminClient({ baseUrl: e.INSFORGE_BASE_URL!, apiKey: e.INSFORGE_SERVICE_KEY! });
  }
  return client.database;
}

function check<T>(res: { data: T | null; error: unknown }, what: string): T {
  if (res.error) {
    const msg = (res.error as { message?: string }).message ?? String(res.error);
    throw new Error(`InsForge ${what} failed: ${msg}`);
  }
  return res.data as T;
}

export class InsforgeStore implements Store {
  readonly kind = "insforge" as const;

  async appendEvent(e: DemoEvent) {
    check(await db().from("events").insert([e]), "insert event");
  }
  async listEvents(sessionId: string) {
    const rows = check<DemoEvent[]>(
      await db().from("events").select("*").eq("session_id", sessionId).order("at", { ascending: true }).limit(2000),
      "list events",
    );
    return rows ?? [];
  }
  async putAgentRun(r: AgentRun) {
    check(await db().from("agent_runs").upsert([r]), "upsert agent run");
  }
  async listAgentRuns(limit: number) {
    return check<AgentRun[]>(
      await db().from("agent_runs").select("*").order("started_at", { ascending: false }).limit(limit),
      "list agent runs",
    ) ?? [];
  }
  async getAnyCompanyRun(key: { id?: string; domain?: string }) {
    let q = db().from("any_company_runs").select("*");
    if (key.id) q = q.eq("id", key.id);
    else if (key.domain) q = q.eq("domain", key.domain);
    else return null;
    const rows = check<AnyCompanyRun[]>(await q.limit(1), "get any-company run");
    return rows?.[0] ?? null;
  }
  async putAnyCompanyRun(r: AnyCompanyRun) {
    check(await db().from("any_company_runs").upsert([r], { onConflict: "domain" }), "upsert any-company run");
  }
  async listAnyCompanyRuns(limit: number) {
    return check<AnyCompanyRun[]>(
      await db().from("any_company_runs").select("*").order("created_at", { ascending: false }).limit(limit),
      "list any-company runs",
    ) ?? [];
  }
  async appendCaptainMessage(m: CaptainMessage) {
    check(await db().from("captain_messages").insert([m]), "insert captain message");
  }
  async listCaptainMessages(sessionId: string, viewerKind: string, companyId: string | null, limit: number) {
    let q = db().from("captain_messages").select("*").eq("session_id", sessionId).eq("viewer_kind", viewerKind);
    q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
    const rows = check<CaptainMessage[]>(await q.order("created_at", { ascending: false }).limit(limit), "list captain messages");
    return (rows ?? []).reverse();
  }
  async clearCaptainThread(sessionId: string, viewerKind: string, companyId: string | null) {
    // Append-only spirit: a thread reset is recorded as a marker message the reader honours.
    let q = db().from("captain_messages").delete().eq("session_id", sessionId).eq("viewer_kind", viewerKind);
    q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
    check(await q, "clear captain thread");
  }
}
