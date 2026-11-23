/**
 * Pipeline (S8) view model. Pure functions of State; safe to import from client code (types + builders only).
 */
import type { State, LedCreated } from "@/lib/data/state";
import type { DayOneResult } from "@/lib/ai/types";
import { portfolioCounts } from "@/lib/domain/portfolio-stats";

export const STAGES = [
  { id: "sourced", label: "Sourced" },
  { id: "first_meeting", label: "First meeting" },
  { id: "diligence", label: "Diligence" },
  { id: "ic", label: "Investment committee" },
  { id: "led", label: "Led" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];
export const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id;

export type DiligenceRow = {
  domain_id: string;
  label: string;
  score: number | null;
  confidence: string | null;
  finding: string | null;
  evidence_titles: string[];
};

export type DealView = {
  id: string;
  codename: string;
  vertical: string;
  region: string;
  stage: StageId;
  note: string;
  what: string;
  proposed_constraint: string;
  constraint_domain_label: string | null;
  why: string;
  evidence_count: number;
  plan_drafts: string[];
  partner_note: string;
  lesson_note: string;
  cta_label: string;
  data_room: { name: string; type: string; modified: string }[];
  diligence: { rows: DiligenceRow[]; evidence: { id: string; claim: string; cited_text: string; title: string }[] } | null;
  diligence_complete: boolean;
};

export type DayOneSummary = {
  dealId: string;
  codename: string;
  companySlug: string;
  binding: string;
  bindingDomain: string;
  priorities: { rank: number; title: string; mission: string | null }[];
  started: { name: string; hours: number }[];
  hoursStarted: number;
  hoursTotal: number;
  partner: { label: string; seatsUsed: number; seatsTotal: number; note: string | null } | null;
  deferred: string[];
  lessons: string[];
};

export type PipelineView = {
  backed: number;
  deals: DealView[];
  signals: { id: string; codename: string; vertical: string; region: string; signal: string }[];
  led: DayOneSummary | null;
  /** Finance recruiting note used when composing deferred lines. */
  recruitingNote: string | null;
  domainLabels: Record<string, string>;
};

function recruitingNote(s: Pick<State, "partner_recruiting">): string | null {
  const row = s.partner_recruiting.find((r) => /finance/i.test(r.role));
  if (!row) return null;
  if (/second hire/i.test(row.role)) return `second finance hire in ${row.state.toLowerCase()}`;
  return `${row.role.toLowerCase()}: ${row.state.toLowerCase()}`;
}

export function deferredLine(name: string, reason: string, note: string | null): string {
  const r = reason.replace(/\.$/, "");
  const withNote = note && /finance/i.test(r) && !r.includes(note) ? `${r} (${note})` : r;
  return `${name} deferred: ${withNote}`;
}

/** Normalise the F7 stream result into the summary shape. */
export function summaryFromResult(r: DayOneResult, codename: string, domainLabels: Record<string, string>, note: string | null): DayOneSummary {
  return {
    dealId: r.deal_id,
    codename,
    companySlug: r.company_slug,
    binding: r.binding.statement,
    bindingDomain: domainLabels[r.binding.domain] ?? r.binding.domain,
    priorities: [...r.priorities].sort((a, b) => a.rank - b.rank).map((p) => ({ rank: p.rank, title: p.title, mission: p.mission?.title ?? null })),
    started: r.started.map((x) => ({ name: x.name, hours: x.hours })),
    hoursStarted: r.hours_started,
    hoursTotal: r.hours_total,
    partner: r.partner
      ? { label: r.partner.label, seatsUsed: r.partner.seats_used, seatsTotal: r.partner.seats_total, note: r.partner.note }
      : null,
    deferred: r.deferred.map((d) => deferredLine(d.name, d.reason, note)),
    lessons: r.lessons.map((l) => l.title),
  };
}

/** Rebuild the summary from the folded state when this session already led the deal. */
function summaryFromState(s: State, dealId: string, note: string | null, domainLabels: Record<string, string>): DayOneSummary | null {
  const rec = s.extras.ledResults[dealId];
  const deal = s.deals.find((d) => d.id === dealId);
  const c = rec?.created as unknown as LedCreated | undefined;
  if (!rec || !c?.company || !deal) return null;
  const progName = (id: string) => s.programs.find((p) => p.id === id)?.name ?? id;
  const missions = [...(c.missions ?? [])];
  const op = (c.operator_updates ?? []).map((u) => ({ u, op: s.operators.find((o) => o.id === u.operator_id) })).find((x) => x.u.seats_used != null && x.op);
  const seatsUsed = op?.op?.seats_used ?? 0;
  const seatsTotal = op?.op?.seats_total ?? 0;
  const started = (c.enrolments ?? []).map((e) => ({ name: progName(e.program_id), hours: e.hours }));
  return {
    dealId,
    codename: deal.codename,
    companySlug: c.company.id,
    binding: c.constraint.statement,
    bindingDomain: domainLabels[c.constraint.domain_id] ?? c.constraint.domain_id,
    priorities: [...(c.priorities ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .map((p) => ({ rank: p.rank, title: p.title, mission: missions.find((m) => m.priority_id === p.id)?.title ?? null })),
    started,
    hoursStarted: started.reduce((a, x) => a + x.hours, 0),
    hoursTotal: c.allocation?.hours_total ?? 0,
    partner: op?.op
      ? {
          label: `${op.op.focus} board partner`,
          seatsUsed,
          seatsTotal,
          note: seatsTotal > 0 && seatsUsed >= seatsTotal ? `Recruit before the next ${op.op.focus} deal` : null,
        }
      : null,
    deferred: (c.deferred ?? []).map((d) => deferredLine(progName(d.program_id), d.reason, note)),
    lessons: (c.lesson_ids ?? []).map((id) => s.lessons.find((l) => l.id === id)?.title ?? id),
  };
}

export function getPipeline(s: State): PipelineView {
  const domainLabels = Object.fromEntries(s.domains.map((d) => [d.id, d.label]));
  const note = recruitingNote(s);
  const deals: DealView[] = s.deals.map((d) => {
    const scores = new Map((d.diligence?.scores ?? []).map((x) => [x.domain_id, x]));
    const evTitle = new Map((d.diligence?.evidence ?? []).map((e) => [e.id, e.title]));
    const rows: DiligenceRow[] = [...s.domains]
      .sort((a, b) => a.sort - b.sort)
      .map((dom) => {
        const sc = scores.get(dom.id);
        return {
          domain_id: dom.id,
          label: dom.label,
          score: sc?.score ?? null,
          confidence: sc?.confidence ?? null,
          finding: sc?.finding ?? null,
          evidence_titles: (sc?.evidence_ids ?? []).map((id) => evTitle.get(id) ?? id),
        };
      });
    return {
      id: d.id,
      codename: d.codename,
      vertical: d.vertical,
      region: d.region,
      stage: d.stage,
      note: d.note,
      what: d.what,
      proposed_constraint: d.proposed_constraint,
      constraint_domain_label: d.constraint_domain_id ? (domainLabels[d.constraint_domain_id] ?? d.constraint_domain_id) : null,
      why: d.why,
      evidence_count: d.evidence_count,
      plan_drafts: d.plan_drafts,
      partner_note: d.partner_note,
      lesson_note: d.lesson_note,
      cta_label: d.cta_label,
      data_room: d.data_room ?? [],
      diligence: d.diligence ? { rows, evidence: d.diligence.evidence } : null,
      diligence_complete: !!d.diligence && rows.length > 0 && rows.every((r) => r.score != null),
    };
  });
  const ledId = Object.keys(s.extras.ledResults)[0] ?? null;
  return {
    backed: portfolioCounts(s).backed,
    deals,
    signals: s.sourcing_signals.map((x) => ({ id: x.id, codename: x.codename, vertical: x.vertical, region: x.region, signal: x.signal })),
    led: ledId ? summaryFromState(s, ledId, note, domainLabels) : null,
    recruitingNote: note,
    domainLabels,
  };
}
