/**
 * Tool registry types (docs/08-mcp-and-integrations.md §1).
 * One registry serves Captain (in-process tool use) and the public MCP server.
 */
import type { z } from "zod";
import type { Ref } from "@/lib/ai/sse";
import type { AnyViewer } from "@/lib/viewer";
import { ScopeError, assertCompanyScope } from "@/lib/viewer";
import { getSeedState, getState, type State } from "@/lib/data";
import type { Company } from "@/lib/domain/schemas";

export type ToolScope = "rypples" | "founder" | "public";
export type ToolCtx = { viewer: AnyViewer; sessionId?: string | null };
export type ToolResult<O> = { data: O; refs: Ref[] };

export type ToolDef<I = unknown, O = unknown> = {
  name: string;
  title: string;
  description: string;
  input: z.ZodType<I>;
  scopes: ToolScope[];
  readOnly: boolean;
  handler: (ctx: ToolCtx, input: I) => Promise<ToolResult<O>>;
};

export function defineTool<I, O>(d: ToolDef<I, O>): ToolDef<I, O> {
  return d;
}

/** Scope check every handler runs first. */
export function allow(ctx: ToolCtx, scopes: ToolScope[]) {
  const k = ctx.viewer.kind === "rypples" ? "rypples" : ctx.viewer.kind === "founder" ? "founder" : "public";
  if (!scopes.includes(k)) throw new ScopeError();
}

/** PublicViewer reads seed only, never session overlays. */
export async function stateFor(ctx: ToolCtx): Promise<State> {
  if (ctx.viewer.kind === "public") return getSeedState();
  return getState(ctx.sessionId ?? null);
}

export const isFounder = (ctx: ToolCtx) => ctx.viewer.kind === "founder";
export const founderCompanyId = (ctx: ToolCtx) => (ctx.viewer.kind === "founder" ? ctx.viewer.companyId : null);

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Resolve a company by slug or id, enforcing scope: founders only their own company;
 * the public viewer only public seed companies; never the unannounced company.
 */
export function companyFor(ctx: ToolCtx, s: State, slug: string): Company {
  const c = s.companies.find((x) => x.slug === slug || x.id === slug);
  if (c) assertCompanyScope(ctx.viewer, c.id);
  else if (ctx.viewer.kind === "founder") throw new ScopeError();
  if (!c || c.status === "unannounced" || (!c.public && !c.session_added) || (ctx.viewer.kind === "public" && !c.public))
    throw new NotFoundError(`No company found for "${slug}"`);
  return c;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
export const href = (path: string) => `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;

/** Ref constructors (absolute hrefs back to the prototype). */
export const ref = {
  company: (c: Company, viewer: AnyViewer): Ref => ({
    type: "company",
    id: c.slug,
    label: c.name,
    href: href(viewer.kind === "founder" ? `/engine/${c.slug}` : `/os/companies/${c.slug}`),
    provenance: c.provenance,
  }),
  portfolio: (): Ref => ({ type: "portfolio", id: "stats", label: "Portfolio", href: href("/os/portfolio"), provenance: "scenario" }),
  benchmark: (domain: string, label: string, provenance: Ref["provenance"]): Ref => ({
    type: "benchmark",
    id: domain,
    label: `Benchmarks · ${label}`,
    href: href("/os/investor-relations?tab=acceleration"),
    provenance,
  }),
  lesson: (id: string, title: string, provenance: Ref["provenance"]): Ref => ({ type: "lesson", id, label: `Playbook · ${title}`, href: href("/os/playbook"), provenance }),
  growth: (): Ref => ({ type: "growth_engine", id: "capacity", label: "Operating partners", href: href("/os/operating-partners"), provenance: "illustrative" }),
  program: (id: string, name: string): Ref => ({ type: "program", id, label: `Program · ${name}`, href: href("/os/operating-partners"), provenance: "illustrative" }),
  operator: (id: string, role: string): Ref => ({ type: "operator", id, label: `Operating partner · ${role}`, href: href(`/os/operating-partners?partner=${id}`), provenance: "illustrative" }),
  source: (id: string, title: string, url: string): Ref => ({ type: "source", id, label: title, url, provenance: "public" }),
  diagnostic: (id: string, companyName: string, slug: string, provenance: Ref["provenance"]): Ref => ({
    type: "diagnostic",
    id,
    label: `Diagnostic · ${companyName}`,
    href: href(`/os/companies/${slug}/diagnostic`),
    provenance,
  }),
  pipeline: (): Ref => ({ type: "pipeline", id: "board", label: "Pipeline", href: href("/os/pipeline"), provenance: "illustrative" }),
  deal: (id: string, codename: string): Ref => ({ type: "deal", id, label: `Pipeline · ${codename}`, href: href(`/os/pipeline?deal=${id}`), provenance: "illustrative" }),
  decision: (id: string, question: string, route: string): Ref => ({ type: "decision", id, label: `Decision · ${question}`, href: href(route), provenance: "scenario" }),
  ledger: (slug: string, name: string, founder: boolean): Ref => ({
    type: "ledger",
    id: slug,
    label: `Ledger · ${name}`,
    href: href(founder ? `/engine/${slug}` : `/os/companies/${slug}?tab=ledger`),
    provenance: "illustrative",
  }),
  allocation: (slug: string, name: string, founder: boolean): Ref => ({
    type: "allocation",
    id: slug,
    label: `Allocation · ${name}`,
    href: href(founder ? `/engine/${slug}` : `/os/companies/${slug}?tab=programs`),
    provenance: "illustrative",
  }),
  boardPack: (id: string, name: string, slug: string, founder: boolean): Ref => ({
    type: "board_pack",
    id,
    label: `Board pack · ${name}`,
    href: href(founder ? `/engine/${slug}/board-pack` : `/os/companies/${slug}`),
    provenance: "scenario",
  }),
  impact: (): Ref => ({ type: "impact", id: "navigator", label: "Ocean Impact Navigator", href: href("/os/investor-relations?tab=impact"), provenance: "illustrative" }),
  paths: (): Ref => ({ type: "strategic_paths", id: "paths", label: "Strategic paths", href: href("/os/investor-relations?tab=paths"), provenance: "illustrative" }),
  markets: (slug: string, name: string): Ref => ({ type: "market_evidence", id: slug, label: `Market evidence · ${name}`, href: href(`/os/companies/${slug}?tab=market`), provenance: "public" }),
  proposal: (id: string, title: string): Ref => ({ type: "proposal", id, label: `Proposal · ${title}`, provenance: "generated" }),
};

/** De-duplicate refs on type + id. */
export function uniqRefs(refs: Ref[]): Ref[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.type}/${r.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
