import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { State } from "../state";
import type { Company, DomainSlug, Provenance } from "@/lib/domain/schemas";
import { effectiveBenchmark, sourceLabel } from "@/lib/domain/benchmarks";
import { allocationUsed } from "@/lib/domain/capacity";
import { companyRating, daysOpen, openConstraint } from "@/lib/domain/portfolio-stats";
import { dayInFirst100, dayMonth, fullDate, offsetDate, offsetLabel, parseIso, weekday } from "@/lib/scenario";
import type { AnyCompanyResult } from "@/lib/ai/types";

export type SrcRef = { id: string; label: string; href: string };
const srcRef = (s: State, id: string | null | undefined): SrcRef | null => {
  if (!id) return null;
  const x = s.sources.find((x) => x.id === id);
  return x ? { id, label: x.title, href: x.url } : null;
};
const srcRefs = (s: State, ids: string[]) => ids.map((i) => srcRef(s, i)).filter((x): x is SrcRef => !!x);
const domainLabel = (s: State, d: DomainSlug | null) => (d ? (s.domains.find((x) => x.slug === d)?.label ?? d) : "");

export const COMPANY_TAB_KEYS = ["diagnostic", "risks", "market", "programs", "ledger", "board"] as const;
export type CompanyTab = (typeof COMPANY_TAB_KEYS)[number];

export type Head = {
  slug: string;
  name: string;
  tagline: string | null;
  vertical: string | null;
  region: string | null;
  stage: string | null;
  website: string | null;
};
const head = (c: Company): Head => ({
  slug: c.slug,
  name: c.name,
  tagline: c.tagline,
  vertical: c.vertical,
  region: c.region,
  stage: c.stage,
  website: c.website,
});

export function nextBoardOf(s: State, c: Company) {
  const m = s.board_meetings.find((b) => b.company_id === c.id && b.kind === "next");
  const offset = m?.at_offset ?? c.next_board_offset;
  if (offset != null) return { offset, label: offsetLabel(offset), weekday: weekday(offsetDate(offset)), note: m?.note ?? null };
  const label = m?.label ?? c.next_board_label ?? null;
  return label ? { offset: null, label, weekday: null, note: m?.note ?? null } : null;
}

export type DiagRow = {
  domain: DomainSlug;
  label: string;
  score: number | null;
  binding: boolean;
  finding: string;
  sources: SrcRef[];
  note: string | null;
  provenance: Provenance;
};

function diagnosticFor(s: State, c: Company) {
  const list = s.diagnostics.filter((d) => d.company_id === c.id && d.kind !== "any_company");
  const d = list.find((d) => d.status === "confirmed") ?? list[0] ?? null;
  if (!d) return null;
  const scores = s.dimension_scores.filter((x) => x.diagnostic_id === d.id);
  const rows: DiagRow[] = s.domains
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .flatMap((dom) => {
      const x = scores.find((sc) => sc.domain_id === dom.slug);
      if (!x) return [];
      return [
        {
          domain: dom.slug,
          label: dom.label,
          score: x.score,
          binding: x.is_binding,
          finding: x.finding,
          sources: srcRefs(s, x.source_ids),
          note: x.note,
          provenance: d.provenance,
        },
      ];
    });
  const meta =
    d.confirmed_label ??
    s.extras.confirmedBy[d.id] ??
    (d.status === "confirmed" ? "Confirmed" : d.status === "disputed" ? "Disputed by the founder" : "Proposed · drafted by Captain");
  const bindingRow = rows.find((r) => r.binding) ?? rows.find((r) => r.domain === d.binding_domain_id) ?? null;
  return { d, rows, meta, bindingRow };
}

export function getCompanyView(s: State, slug: string) {
  const c = s.companies.find((x) => x.slug === slug);
  if (!c || (c.status !== "active" && c.status !== "exited")) return null;
  if (c.status === "exited") return getExitedView(s, c);
  return c.anchor ? getFullView(s, c) : getStandardView(s, c);
}

function getExitedView(s: State, c: Company) {
  const sp = s.strategic_paths.find((p) => p.company_id === c.id);
  return {
    kind: "exited" as const,
    head: head(c),
    note: c.exit_note,
    path: sp ? { now: sp.now, provenance: sp.now_provenance, source: srcRef(s, sp.now_source_id), likely: sp.likely } : null,
    sources: srcRefs(s, [c.source_id ?? ""].filter(Boolean)),
  };
}

function getFullView(s: State, c: Company) {
  const person = s.people.find((p) => p.id === c.ceo_person_id) ?? s.people.find((p) => p.company_id === c.id && p.kind === "founder") ?? null;
  const ceoName = person?.name ?? null;
  const ceoFirst = ceoName?.split(" ")[0] ?? "the founder";

  // meta line from facts, with a source chip per fact
  const fact = (key: string) => s.facts.find((f) => f.company_id === c.id && f.key === key);
  const meta: { text: string; source: SrcRef | null; note: string | null }[] = [];
  const f1 = fact("ceo");
  if (f1) meta.push({ text: `CEO ${f1.value.split(",")[0]}`, source: srcRef(s, f1.source_id), note: f1.verify_note });
  else if (ceoName) meta.push({ text: `CEO ${ceoName}`, source: srcRef(s, person?.source_id), note: null });
  const f2 = fact("system");
  if (f2) meta.push({ text: f2.value.split(";")[0], source: srcRef(s, f2.source_id), note: f2.verify_note });
  const f3 = fact("cost");
  if (f3) meta.push({ text: `${f3.label} ${f3.value}`, source: srcRef(s, f3.source_id), note: f3.verify_note });

  // lifecycle
  const order = ["day0", "first100", "quarterly", "strategic"];
  const stages = s.lifecycle_stages
    .filter((l) => l.company_id === c.id)
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((l) => ({ key: l.key, label: l.label, when: l.when, note: l.note, current: l.status === "in_progress" }));
  const day = c.round_closed_at ? dayInFirst100(c.round_closed_at) : null;
  const scenarioLine = c.round_closed_at
    ? `Scenario: Rypples led ${c.name}'s next round on ${fullDate(parseIso(c.round_closed_at))}${c.board_seat ? " and took a board seat" : ""}.`
    : null;

  const dg = diagnosticFor(s, c);
  const next = nextBoardOf(s, c);
  const decision = s.decisions.find((d) => d.company_id === c.id) ?? null;
  const layers = s.capital_layers.filter((l) => l.company_id === c.id).sort((a, b) => a.sort - b.sort);
  const plantsFact = fact("plants");

  // technical risks
  const risks = s.technical_risks.filter((r) => r.company_id === c.id);
  const fr = s.enrolments.find((e) => e.company_id === c.id && e.program_id === "field-reliability");
  const canPropose = risks.length > 0 && s.programs.some((p) => p.id === "field-reliability");
  const proposed = !!fr && fr.status !== "proposed";

  // programs
  const alloc = s.allocations.find((a) => a.company_id === c.id) ?? null;
  const used = allocationUsed(s.enrolments, c.id);
  const enrolments = s.enrolments
    .filter((e) => e.company_id === c.id)
    .map((e) => {
      const prog = s.programs.find((p) => p.id === e.program_id);
      const op = s.operators.find((o) => o.id === e.operator_id);
      const state =
        e.status === "running"
          ? `Running${e.week && e.of_weeks ? ` · week ${e.week} of ${e.of_weeks}` : e.state_note ? ` · ${e.state_note.toLowerCase()}` : ""}`
          : e.status === "proposed"
            ? "Proposed by board partner"
            : e.status === "requested"
              ? "Requested"
              : "Done";
      return {
        id: e.id,
        name: e.label ?? prog?.name ?? e.program_id,
        operatorInitials: op?.initials ?? "",
        operatorRole: op?.role ?? prog?.delivered_by_role ?? "",
        state,
        tone: (e.status === "running" || e.status === "done" ? "lime" : e.status === "requested" ? "amber" : "neutral") as "lime" | "amber" | "neutral",
        hours: e.hours,
        counted: e.status !== "proposed",
        provenance: e.provenance,
      };
    });

  // ledger
  const commitments = s.commitments.filter((x) => x.company_id === c.id).sort((a, b) => a.sort - b.sort);
  const delivered = commitments.filter((x) => x.status === "delivered").length;

  // board history
  const past = s.board_meetings.filter((b) => b.company_id === c.id && b.kind === "past");
  const pack = s.board_packs.find((p) => p.company_id === c.id) ?? null;
  const shared = !!pack && (pack.status === "shared" || s.extras.sharedPacks.includes(pack.id));
  const needs = pack ? s.board_pack_sections.filter((x) => x.pack_id === pack.id && x.state === "needs").length : 0;
  const packState = !pack
    ? null
    : shared
      ? "Shared · diagnostic sent to " + ceoFirst
      : `Drafting · ${needs} ${needs === 1 ? "section needs" : "sections need"} ${ceoFirst}`;

  const hasMarket = s.facts.some((f) => f.company_id === c.id && f.key.startsWith("pilot"));
  const tabs: { key: CompanyTab; label: string }[] = [];
  if (dg && dg.rows.length) tabs.push({ key: "diagnostic", label: "Diagnostic" });
  if (risks.length) tabs.push({ key: "risks", label: "Technical risks" });
  if (hasMarket) tabs.push({ key: "market", label: "Market evidence" });
  tabs.push({ key: "programs", label: "Programs" }, { key: "ledger", label: "Ledger" }, { key: "board", label: "Board history" });

  return {
    kind: "full" as const,
    head: head(c),
    ceoFirst,
    meta,
    lifecycle: { day, scenarioLine, stages },
    preRead: dg
      ? {
          meta: `${next?.label ?? "Next board"} · pre-read refreshed today`,
          boardWeekday: next?.weekday ?? null,
          binding: dg.d.binding_statement
            ? {
                label: domainLabel(s, dg.d.binding_domain_id),
                statement: dg.d.binding_statement,
                detail: dg.d.binding_detail,
                sources: dg.bindingRow?.sources ?? [],
              }
            : null,
          questions: dg.d.questions,
          decision: decision
            ? {
                id: decision.id,
                question: decision.question,
                line: decision.line,
                open: decision.status === "open",
                outcome: s.extras.resolvedDecisions[decision.id] ?? null,
              }
            : null,
          layers: layers.map((l) => ({ id: l.id, name: l.name, who: l.who, status: l.status, provenance: l.provenance })),
          layersSource: plantsFact ? srcRef(s, plantsFact.source_id) : null,
        }
      : null,
    tabs,
    diagnostic: dg ? { meta: dg.meta, rows: dg.rows } : null,
    risks: { rows: risks, canPropose, proposed, companyId: c.id },
    hasMarket,
    programs: {
      allocation: alloc,
      used,
      enrolments,
    },
    ledger: {
      rating: companyRating(s, c.id),
      delivered,
      rows: commitments.map((x) => ({
        id: x.id,
        title: x.title,
        from: x.from_label,
        due: x.due_label,
        status: x.status,
        rating: x.rating,
        provenance: x.provenance,
      })),
    },
    board: {
      past: past.map((b) => ({
        id: b.id,
        label: b.label,
        when: b.at ? dayMonth(parseIso(b.at)) : "",
        note: b.note,
      })),
      next: next ? { label: next.label, note: next.note } : null,
      packState,
      packQuarter: pack?.quarter ?? null,
    },
  };
}

function getStandardView(s: State, c: Company) {
  const k = openConstraint(s, c.id);
  const b = k ? effectiveBenchmark(k.domain_id, s.benchmarks, s.cleared_cases) : null;
  const d = k ? daysOpen(k) : null;
  const sp = s.strategic_paths.find((p) => p.company_id === c.id) ?? null;
  const kpi = s.impact_kpis.find((p) => p.company_id === c.id) ?? null;
  const next = nextBoardOf(s, c);
  return {
    kind: "standard" as const,
    head: head(c),
    constraint: k
      ? {
          domain: domainLabel(s, k.domain_id),
          statement: k.statement,
          provisional: k.provisional,
          provenance: k.provenance,
          days: d,
          benchmark: b?.days ?? null,
          benchmarkLabel: b ? sourceLabel(b.source_kind) : null,
        }
      : null,
    rating: companyRating(s, c.id),
    nextBoard: next?.label ?? null,
    path: sp
      ? {
          now: sp.now,
          nowProvenance: sp.now_provenance,
          source: srcRef(s, sp.now_source_id),
          likely: sp.likely,
          status: sp.program_status,
        }
      : null,
    kpi: kpi ? { text: kpi.kpi, status: kpi.status, provenance: kpi.provenance } : null,
    domains: s.domains.slice().sort((a, b) => a.sort - b.sort),
  };
}

export type F2Rows = {
  runDate: string | null;
  rows: { domain: DomainSlug; label: string; score: number | null; confidence: string; finding: string; sources: { label: string; href: string }[] }[];
};

/** Reviewed precomputed F2 run for a standard company, or null. Never throws. */
export async function loadReviewedF2(s: State, slug: string): Promise<F2Rows | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "precomputed", "f2", `${slug}.json`), "utf8");
    const r = JSON.parse(raw) as AnyCompanyResult;
    if (r.reviewed !== true || !Array.isArray(r.scores) || r.scores.length === 0) return null;
    const ev = new Map((r.evidence ?? []).map((e) => [e.id, e]));
    const rows = s.domains
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .flatMap((dom) => {
        const sc = r.scores.find((x) => x.domain === dom.slug);
        if (!sc) return [];
        const seen = new Set<string>();
        const sources = (sc.evidence_ids ?? []).flatMap((id) => {
          const e = ev.get(id);
          if (!e?.url || seen.has(e.url)) return [];
          seen.add(e.url);
          return [{ label: e.title, href: e.url }];
        });
        return [{ domain: dom.slug, label: dom.label, score: sc.score, confidence: sc.confidence, finding: sc.finding, sources }];
      });
    return { runDate: r.created_at ? fullDate(new Date(r.created_at)) : null, rows };
  } catch {
    return null;
  }
}

/** S4c: the Growth Engine schedule, deterministic from data. Null unless the company is an anchor. */
export function getSchedule(s: State, slug: string) {
  const c = s.companies.find((x) => x.slug === slug);
  if (!c || !c.anchor || c.status !== "active") return null;
  const alloc = s.allocations.find((a) => a.company_id === c.id) ?? null;
  const used = allocationUsed(s.enrolments, c.id);
  const bp = s.operators.find((o) => o.role_key === "board_partner" && o.covers.includes(c.id)) ?? null;
  const enrolments = s.enrolments
    .filter((e) => e.company_id === c.id)
    .map((e) => ({
      id: e.id,
      name: e.label ?? s.programs.find((p) => p.id === e.program_id)?.name ?? e.program_id,
      status: e.status,
      hours: e.hours,
    }));
  const k = openConstraint(s, c.id);
  const b = k ? effectiveBenchmark(k.domain_id, s.benchmarks, s.cleared_cases) : null;
  return {
    company: { slug: c.slug, name: c.name },
    roundClose: c.round_closed_at ? fullDate(parseIso(c.round_closed_at)) : null,
    boardSeat: c.board_seat,
    boardPartner: bp ? { role: bp.role, focus: bp.focus } : null,
    allocation: alloc,
    used,
    enrolments,
    programs: s.programs.map((p) => ({ id: p.id, name: p.name, outcome: p.outcome, weeks: p.length_weeks, hours: p.hours, by: p.delivered_by_role })),
    promises: s.promises,
    constraint: k && b ? { domain: domainLabel(s, k.domain_id), days: b.days, label: sourceLabel(b.source_kind) } : null,
  };
}
