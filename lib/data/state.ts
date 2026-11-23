/**
 * State = seed ∪ session events, folded in time order (docs/04-data-model.md §12).
 * Seed rows are never mutated: we fold into a structured clone.
 */
import type {
  Commitment,
  Company,
  CompanyConstraint,
  Deal,
  Decision,
  Diagnostic,
  DimensionScore,
  Evidence,
  Seed,
} from "@/lib/domain/schemas";
import type { DemoEvent } from "./events";

export type Proposal = {
  id: string;
  flow: string;
  kind: string;
  title: string;
  detail: string;
  target: string | null;
  status: "proposed" | "approved" | "rejected";
  run_id: string | null;
  at: string;
};

export type OpsEntry = { site: string; uptime_pct: number; output_m3_day: number; at: string };

export type SessionExtras = {
  /** company ids added in this session (F7) */
  addedCompanyIds: string[];
  resolvedDecisions: Record<string, string>;
  disputes: { company_id: string; domain_id: string; note: string; at: string }[];
  sentLessons: { lesson_id: string; company_id: string; at: string }[];
  usefulLessons: { lesson_id: string; company_id: string }[];
  intakeReviewed: Record<string, "approved" | "rejected">;
  pilotConfirmed: Record<string, number>;
  sectionContent: Record<string, string>; // `${pack_id}:${key}` → md
  opsEntries: Record<string, OpsEntry[]>; // pack_id → entries
  sharedPacks: string[];
  proposals: Proposal[];
  shareholderEdits: Record<string, Record<number, string>>;
  shareholderDraft: Record<string, unknown>;
  shareholderApproved: string[];
  circleInvitesSent: string[];
  ledResults: Record<string, { created: Record<string, unknown>; run_id: string | null; at: string }>;
  confirmedBy: Record<string, string>; // diagnostic id → label
  proposedDiagnostics: { company_id: string; diagnostic: Diagnostic; scores: DimensionScore[]; evidence: Evidence[] }[];
  lessonMatchesRunId: Record<string, string | null>;
};

export type State = Seed & { extras: SessionExtras; events: DemoEvent[] };

const emptyExtras = (): SessionExtras => ({
  addedCompanyIds: [],
  resolvedDecisions: {},
  disputes: [],
  sentLessons: [],
  usefulLessons: [],
  intakeReviewed: {},
  pilotConfirmed: {},
  sectionContent: {},
  opsEntries: {},
  sharedPacks: [],
  proposals: [],
  shareholderEdits: {},
  shareholderDraft: {},
  shareholderApproved: [],
  circleInvitesSent: [],
  ledResults: {},
  confirmedBy: {},
  proposedDiagnostics: [],
  lessonMatchesRunId: {},
});

/** Records created by F7 and carried inside the deal.led event. */
export type LedCreated = {
  company: Company;
  constraint: CompanyConstraint;
  plan: Seed["plans"][number];
  priorities: Seed["priorities"];
  missions: Seed["missions"];
  allocation: Seed["allocations"][number];
  enrolments: Seed["enrolments"];
  commitments: Commitment[];
  lifecycle: Seed["lifecycle_stages"];
  board_meetings: Seed["board_meetings"];
  founder: Seed["people"][number];
  operator_updates: { operator_id: string; seats_used?: number; hours_committed?: number }[];
  lesson_ids: string[];
  deferred: { program_id: string; reason: string }[];
  diagnostic: Diagnostic;
  scores: DimensionScore[];
};

export function fold(seed: Seed, events: DemoEvent[]): State {
  const s = structuredClone(seed) as State;
  s.extras = emptyExtras();
  s.events = events;
  const x = s.extras;

  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const p = e.payload as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    switch (e.type) {
      case "decision.resolved": {
        x.resolvedDecisions[p.decision_id as string] = p.outcome as string;
        const d = s.decisions.find((d) => d.id === p.decision_id);
        if (d) d.status = "resolved";
        break;
      }
      case "decision.created": {
        if (!s.decisions.some((d) => d.id === p.decision_id)) {
          const d: Decision = {
            id: p.decision_id as string,
            firm_id: e.firm_id,
            company_id: (p.company_id as string) ?? null,
            context_label: p.context_label as string,
            question: p.question as string,
            line: p.line as string,
            action_label: p.action_label as string,
            route: p.route as string,
            status: "open",
            sort: 100 + s.decisions.length,
            provenance: "scenario",
          };
          s.decisions.push(d);
        }
        break;
      }
      case "constraint.confirmed": {
        const diag = p.diagnostic_id ? findDiagnostic(s, p.diagnostic_id as string) : null;
        if (diag) {
          diag.status = "confirmed";
          diag.binding_domain_id = p.domain_id as Diagnostic["binding_domain_id"];
          diag.confirmed_by = e.actor;
          diag.confirmed_at = e.at;
          diag.confirmed_label = "Confirmed by Jerome Ternynck";
          x.confirmedBy[diag.id] = "Confirmed by Jerome Ternynck";
        }
        break;
      }
      case "constraint.disputed": {
        x.disputes.push({
          company_id: p.company_id as string,
          domain_id: p.domain_id as string,
          note: p.note as string,
          at: e.at,
        });
        break;
      }
      case "commitment.rated": {
        const c = s.commitments.find((c) => c.id === p.commitment_id);
        if (c && c.status === "delivered") c.rating = p.rating as number;
        break;
      }
      case "commitment.created": {
        if (!s.commitments.some((c) => c.id === p.commitment_id)) {
          s.commitments.push({
            id: p.commitment_id as string,
            firm_id: e.firm_id,
            company_id: p.company_id as string,
            title: p.title as string,
            from_label: p.from_label as string,
            operator_id: null,
            due_label: p.due_label as string,
            due_offset: null,
            status: "not_started",
            rating: null,
            sort: 50 + s.commitments.length,
            provenance: "illustrative",
          });
        }
        break;
      }
      case "program.requested": {
        const existing = s.enrolments.find(
          (en) => en.company_id === p.company_id && en.program_id === p.program_id,
        );
        const alloc = s.allocations.find((a) => a.company_id === p.company_id);
        const counted = s.enrolments.filter(
          (en) => en.company_id === p.company_id && (en.status === "running" || en.status === "requested" || en.status === "done"),
        ).length;
        if (existing && existing.status === "proposed") {
          if (!alloc || counted < alloc.programs_total) existing.status = "requested";
        } else if (!existing && (!alloc || counted < alloc.programs_total)) {
          const prog = s.programs.find((pr) => pr.id === p.program_id);
          s.enrolments.push({
            id: `enr-${e.id}`,
            firm_id: e.firm_id,
            company_id: p.company_id as string,
            program_id: p.program_id as string,
            label: null,
            status: "requested",
            state_note: "requested by the founder",
            week: null,
            of_weeks: prog?.length_weeks ?? null,
            hours: prog?.hours ?? 0,
            operator_id: prog?.delivered_by_operator_id ?? null,
            rating: null,
            provenance: "illustrative",
          });
        }
        break;
      }
      case "lesson.approved": {
        const l = s.lessons.find((l) => l.id === p.lesson_id);
        if (l) {
          l.status = "approved";
          l.approved_by = "jerome";
        }
        break;
      }
      case "lesson.rejected": {
        const l = s.lessons.find((l) => l.id === p.lesson_id);
        if (l) l.status = "rejected";
        break;
      }
      case "lesson.edited": {
        const l = s.lessons.find((l) => l.id === p.lesson_id);
        if (l) {
          l.title = p.title as string;
          l.play = p.play as string[];
        }
        break;
      }
      case "lesson.sent": {
        const m = s.lesson_matches.find((m) => m.lesson_id === p.lesson_id && m.company_id === p.company_id);
        const l = s.lessons.find((l) => l.id === p.lesson_id);
        if (m && l?.status === "approved") {
          m.status = "sent";
          x.sentLessons.push({ lesson_id: p.lesson_id as string, company_id: p.company_id as string, at: e.at });
        }
        break;
      }
      case "lesson.useful": {
        if (!x.usefulLessons.some((u) => u.lesson_id === p.lesson_id && u.company_id === p.company_id)) {
          x.usefulLessons.push({ lesson_id: p.lesson_id as string, company_id: p.company_id as string });
        }
        break;
      }
      case "lesson.matches_replaced": {
        const lessonId = p.lesson_id as string;
        const sent = new Set(
          s.lesson_matches.filter((m) => m.lesson_id === lessonId && m.status === "sent").map((m) => m.company_id),
        );
        s.lesson_matches = s.lesson_matches.filter((m) => m.lesson_id !== lessonId || sent.has(m.company_id));
        for (const m of p.matches as { company_id: string; reason: string; fit: "strong" | "possible" }[]) {
          if (sent.has(m.company_id)) continue;
          s.lesson_matches.push({
            id: `lm-${e.id}-${m.company_id}`,
            lesson_id: lessonId,
            company_id: m.company_id,
            reason: m.reason,
            fit: m.fit,
            status: "matched",
            reason_provenance: "generated",
            verify_note: null,
          });
        }
        x.lessonMatchesRunId[lessonId] = (p.run_id as string) ?? null;
        break;
      }
      case "intake.reviewed":
        x.intakeReviewed[p.intake_id as string] = p.outcome as "approved" | "rejected";
        break;
      case "instrument.shortlisted":
      case "instrument.unshortlisted": {
        const i = s.instruments.find((i) => i.id === p.instrument_id);
        if (i) i.shortlisted = e.type === "instrument.shortlisted";
        break;
      }
      case "pilot.stage_confirmed": {
        const pl = s.pilots.find((pl) => pl.id === p.pilot_id);
        if (pl) {
          pl.stage = p.stage as number;
          x.pilotConfirmed[pl.id] = p.stage as number;
        }
        break;
      }
      case "board_pack.section_saved": {
        const sec = s.board_pack_sections.find((sc) => sc.pack_id === p.pack_id && sc.key === p.section_key);
        if (p.content_md != null) x.sectionContent[`${p.pack_id}:${p.section_key}`] = p.content_md as string;
        if (sec && p.state) {
          sec.state = p.state as "needs" | "ready" | "drafted";
          sec.needs = sec.state === "needs";
          sec.state_label = sec.state === "ready" ? "Ready" : sec.state === "drafted" ? "Drafted · review" : sec.state_label;
        }
        break;
      }
      case "board_pack.ops_added": {
        const k = p.pack_id as string;
        (x.opsEntries[k] ??= []).push({
          site: p.site as string,
          uptime_pct: p.uptime_pct as number,
          output_m3_day: p.output_m3_day as number,
          at: e.at,
        });
        const sec = s.board_pack_sections.find((sc) => sc.pack_id === k && sc.key === "ops");
        if (sec) {
          sec.state = "ready";
          sec.needs = false;
          sec.state_label = "Ready · founder-entered";
        }
        break;
      }
      case "board_pack.shared": {
        const pack = s.board_packs.find((b) => b.id === p.pack_id);
        if (pack) pack.status = "shared";
        if (!x.sharedPacks.includes(p.pack_id as string)) x.sharedPacks.push(p.pack_id as string);
        break;
      }
      case "proposal.created":
        x.proposals.push({
          id: p.proposal_id as string,
          flow: p.flow as string,
          kind: p.kind as string,
          title: p.title as string,
          detail: p.detail as string,
          target: (p.target as string) ?? null,
          status: "proposed",
          run_id: (p.run_id as string) ?? null,
          at: e.at,
        });
        break;
      case "proposal.approved":
      case "proposal.rejected": {
        const pr = x.proposals.find((pr) => pr.id === p.proposal_id);
        const status = e.type === "proposal.approved" ? "approved" : "rejected";
        if (pr) pr.status = status;
        else
          x.proposals.push({
            id: p.proposal_id as string,
            flow: "seed",
            kind: "overnight",
            title: "",
            detail: "",
            target: null,
            status,
            run_id: null,
            at: e.at,
          });
        break;
      }
      case "shareholder_update.edited": {
        const q = p.quarter as string;
        (x.shareholderEdits[q] ??= {})[p.segment_index as number] = p.text as string;
        break;
      }
      case "shareholder_update.redrafted":
        x.shareholderDraft[p.quarter as string] = p.draft;
        x.shareholderEdits[p.quarter as string] = {};
        break;
      case "shareholder_update.approved":
        if (!x.shareholderApproved.includes(p.quarter as string)) x.shareholderApproved.push(p.quarter as string);
        break;
      case "circle.invites_sent":
        if (!x.circleInvitesSent.includes(p.circle_id as string)) x.circleInvitesSent.push(p.circle_id as string);
        break;
      case "circle.member_swapped": {
        const c = s.circles.find((c) => c.id === p.circle_id);
        if (c) {
          c.members = c.members.map((m) => (m === p.out_company_id ? (p.in_company_id as string) : m));
          c.exclusions = c.exclusions.filter((ex) => ex.company_id !== p.in_company_id);
        }
        break;
      }
      case "deal.moved": {
        const d = s.deals.find((d) => d.id === p.deal_id);
        if (d) d.stage = p.to as Deal["stage"];
        break;
      }
      case "deal.created": {
        const deal = p.deal as unknown as Deal;
        if (!s.deals.some((d) => d.id === deal.id)) s.deals.push(deal);
        break;
      }
      case "deal.led": {
        const d = s.deals.find((d) => d.id === p.deal_id);
        if (d) d.stage = "led";
        const c = p.created as unknown as LedCreated;
        x.ledResults[p.deal_id as string] = { created: p.created as Record<string, unknown>, run_id: (p.run_id as string) ?? null, at: e.at };
        if (c?.company && !s.companies.some((co) => co.id === c.company.id)) {
          s.companies.push(c.company);
          x.addedCompanyIds.push(c.company.id);
          s.company_constraints.push(c.constraint);
          s.plans.push(c.plan);
          s.priorities.push(...c.priorities);
          s.missions.push(...c.missions);
          s.allocations.push(c.allocation);
          s.enrolments.push(...c.enrolments);
          s.commitments.push(...c.commitments);
          s.lifecycle_stages.push(...c.lifecycle);
          s.board_meetings.push(...c.board_meetings);
          s.people.push(c.founder);
          s.diagnostics.push(c.diagnostic);
          s.dimension_scores.push(...c.scores);
          for (const u of c.operator_updates) {
            const op = s.operators.find((o) => o.id === u.operator_id);
            if (!op) continue;
            if (u.seats_used != null) op.seats_used = u.seats_used;
            if (u.hours_committed != null) op.hours_committed = u.hours_committed;
            if (!op.covers.includes(c.company.id)) op.covers.push(c.company.id);
          }
          // the Tern IC decision is answered by leading the round
          for (const dec of s.decisions) if (dec.route.includes(`deal=${p.deal_id}`)) dec.status = "resolved";
        }
        break;
      }
      case "diagnostic.proposed": {
        x.proposedDiagnostics.push({
          company_id: p.company_id as string,
          diagnostic: p.diagnostic as unknown as Diagnostic,
          scores: p.scores as unknown as DimensionScore[],
          evidence: p.evidence as unknown as Evidence[],
        });
        break;
      }
    }
  }
  return s;
}

function findDiagnostic(s: State, id: string): Diagnostic | null {
  return (
    s.diagnostics.find((d) => d.id === id) ??
    s.extras.proposedDiagnostics.find((p) => p.diagnostic.id === id)?.diagnostic ??
    null
  );
}
