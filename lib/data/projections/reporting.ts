import fs from "node:fs";
import path from "node:path";
import type { State } from "../state";
import type { ShareholderDraft } from "@/lib/ai/types";
import type { DomainSlug, Provenance } from "@/lib/domain/schemas";
import { effectiveBenchmark, RYPPLES_CASE_THRESHOLD, sourceLabel } from "@/lib/domain/benchmarks";
import { refKey, resolveRef, type ResolvedRef } from "./refs";

export const REPORTING_TABS = [
  { key: "update", label: "Shareholder update" },
  { key: "impact", label: "Impact" },
  { key: "paths", label: "Strategic paths" },
  { key: "acceleration", label: "Acceleration" },
] as const;
export type ReportingTab = (typeof REPORTING_TABS)[number]["key"];

export const QUARTER = "Q4 2026";
const PRECOMPUTED = path.join(process.cwd(), "data", "precomputed", "f6-q4.json");

function asDraft(x: unknown): ShareholderDraft | null {
  const o = x as { draft?: unknown; result?: { data?: unknown } } | null;
  const d = [x, o?.draft, o?.result?.data].find((c) => c && typeof c === "object" && Array.isArray((c as { segments?: unknown }).segments)) as
    | Partial<ShareholderDraft>
    | undefined;
  if (!d || !d.segments) return null;
  return {
    quarter: d.quarter ?? QUARTER,
    title: d.title ?? `${QUARTER} shareholder update`,
    segments: d.segments,
    held_back: Array.isArray(d.held_back) ? d.held_back : [],
    draft_n: typeof d.draft_n === "number" ? d.draft_n : 1,
  };
}

/** Session redraft first, else the precomputed F6 output. Null when neither exists. */
export function loadDraft(s: State, quarter = QUARTER): ShareholderDraft | null {
  const session = asDraft(s.extras.shareholderDraft[quarter]);
  if (session) return session;
  try {
    return asDraft(JSON.parse(fs.readFileSync(PRECOMPUTED, "utf8")));
  } catch {
    return null;
  }
}

export type DraftSegment =
  | { index: number; kind: "text"; text: string; edited: boolean }
  | { index: number; kind: "ref"; resolved: ResolvedRef | null; raw: { type: string; id: string; field: string } };

export function getUpdate(s: State) {
  const draft = loadDraft(s);
  const edits = s.extras.shareholderEdits[QUARTER] ?? {};
  const approved = s.extras.shareholderApproved.includes(QUARTER);
  if (!draft) return { quarter: QUARTER, approved, draft: null };
  const segments: DraftSegment[] = draft.segments.map((seg, index) =>
    seg.kind === "text"
      ? { index, kind: "text", text: edits[index] ?? seg.text, edited: edits[index] != null }
      : { index, kind: "ref", resolved: resolveRef(s, seg.ref), raw: seg.ref },
  );
  const distinct = new Set(draft.segments.flatMap((x) => (x.kind === "ref" ? [refKey(x.ref)] : [])));
  return {
    quarter: QUARTER,
    approved,
    draft: {
      title: draft.title,
      n: draft.draft_n,
      k: distinct.size,
      segments,
      heldBack: draft.held_back.map((h) => ({ label: `${h.type.replace(/_/g, " ")} · ${h.id}`, reason: h.reason })),
    },
  };
}

export function getImpact(s: State) {
  const src = s.sources.find((x) => x.id === "src_oin");
  const rows = s.impact_kpis.map((k) => {
    const c = s.companies.find((c) => c.id === k.company_id);
    return { id: k.id, company: c?.name ?? k.company_id, slug: c?.slug ?? k.company_id, kpi: k.kpi, status: k.status, provenance: k.provenance as Provenance };
  });
  return {
    rows,
    reported: rows.filter((r) => r.status === "reported").length,
    framework: src ? { href: src.url, label: src.publisher } : null,
  };
}

export function getPaths(s: State) {
  const rows = s.strategic_paths.map((p) => {
    const c = s.companies.find((c) => c.id === p.company_id);
    const src = p.now_source_id ? s.sources.find((x) => x.id === p.now_source_id) : null;
    return {
      id: p.id,
      company: c?.name ?? p.company_id,
      slug: c?.slug ?? p.company_id,
      now: p.now,
      nowProvenance: p.now_provenance,
      source: src ? { href: src.url, label: src.publisher } : null,
      likely: p.likely,
      exited: c?.status === "exited",
      program: p.program_status,
      note: p.verify_note,
    };
  });
  return { rows };
}

export function getAcceleration(s: State) {
  const domains = [...s.domains]
    .sort((a, b) => a.sort - b.sort)
    .map((d) => ({ slug: d.slug as DomainSlug, label: d.label, n: s.cleared_cases.filter((c) => c.domain_id === d.slug).length }));
  const table = domains.map((d) => {
    const b = effectiveBenchmark(d.slug, s.benchmarks, s.cleared_cases);
    return {
      slug: d.slug,
      constraint: d.label,
      days: b.days,
      source: sourceLabel(b.source_kind),
      sourceNote: b.source_note,
      cases: b.cases,
      confidence: b.confidence,
      outside: b.source_kind !== "rypples",
    };
  });
  return { domains, table, threshold: RYPPLES_CASE_THRESHOLD, cases: s.cleared_cases, benchmarks: s.benchmarks, total: s.cleared_cases.length };
}
