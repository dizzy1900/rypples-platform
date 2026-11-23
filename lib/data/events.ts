/**
 * The append-only event log (docs/04-data-model.md §11).
 * Every visitor write is an event carrying the visitor's session_id.
 * Projections fold seed ∪ session events, in time order.
 */
import { z } from "zod";
import { DomainSlug } from "@/lib/domain/schemas";

const P = <T extends z.ZodRawShape>(shape: T) => z.object(shape);

export const EventPayloads = {
  "decision.resolved": P({ decision_id: z.string(), outcome: z.string() }),
  "decision.created": P({
    decision_id: z.string(),
    company_id: z.string().nullable(),
    context_label: z.string(),
    question: z.string(),
    line: z.string(),
    action_label: z.string(),
    route: z.string(),
  }),
  "constraint.confirmed": P({
    company_id: z.string(),
    diagnostic_id: z.string().nullable(),
    domain_id: DomainSlug,
    statement: z.string().nullable(),
    reason: z.string().nullable(),
  }),
  "constraint.disputed": P({ company_id: z.string(), domain_id: DomainSlug, note: z.string().max(2000) }),
  "commitment.rated": P({ commitment_id: z.string(), rating: z.number().int().min(1).max(5) }),
  "commitment.created": P({
    commitment_id: z.string(),
    company_id: z.string(),
    title: z.string(),
    from_label: z.string(),
    due_label: z.string(),
  }),
  "program.requested": P({
    company_id: z.string(),
    program_id: z.string(),
    via: z.enum(["founder", "board_partner"]),
  }),
  "lesson.approved": P({ lesson_id: z.string() }),
  "lesson.rejected": P({ lesson_id: z.string() }),
  "lesson.edited": P({ lesson_id: z.string(), title: z.string().max(2000), play: z.array(z.string().max(2000)) }),
  "lesson.sent": P({ lesson_id: z.string(), company_id: z.string() }),
  "lesson.useful": P({ lesson_id: z.string(), company_id: z.string() }),
  "lesson.matches_replaced": P({
    lesson_id: z.string(),
    matches: z.array(z.object({ company_id: z.string(), reason: z.string(), fit: z.enum(["strong", "possible"]) })),
    run_id: z.string().nullable(),
  }),
  "intake.reviewed": P({ intake_id: z.string(), outcome: z.enum(["approved", "rejected"]) }),
  "instrument.shortlisted": P({ instrument_id: z.string() }),
  "instrument.unshortlisted": P({ instrument_id: z.string() }),
  "pilot.stage_confirmed": P({ pilot_id: z.string(), stage: z.number().int().min(0).max(4) }),
  "board_pack.section_saved": P({
    pack_id: z.string(),
    section_key: z.string(),
    content_md: z.string().max(6000).nullable(),
    state: z.enum(["needs", "ready", "drafted"]).nullable(),
  }),
  "board_pack.ops_added": P({
    pack_id: z.string(),
    site: z.string().max(200),
    uptime_pct: z.number().min(0).max(100),
    output_m3_day: z.number().min(0).max(1_000_000),
  }),
  "board_pack.shared": P({ pack_id: z.string(), company_id: z.string() }),
  "proposal.created": P({
    proposal_id: z.string(),
    flow: z.string(),
    kind: z.string(),
    title: z.string(),
    detail: z.string(),
    target: z.string().nullable(),
    run_id: z.string().nullable(),
  }),
  "proposal.approved": P({ proposal_id: z.string() }),
  "proposal.rejected": P({ proposal_id: z.string() }),
  "shareholder_update.edited": P({ quarter: z.string(), segment_index: z.number().int(), text: z.string().max(2000) }),
  "shareholder_update.redrafted": P({ quarter: z.string(), draft: z.unknown(), run_id: z.string().nullable() }),
  "shareholder_update.approved": P({ quarter: z.string() }),
  "circle.invites_sent": P({ circle_id: z.string() }),
  "circle.member_swapped": P({ circle_id: z.string(), out_company_id: z.string(), in_company_id: z.string() }),
  "deal.moved": P({ deal_id: z.string(), from: z.string(), to: z.string() }),
  "deal.created": P({ deal: z.record(z.string(), z.unknown()) }),
  "deal.led": P({ deal_id: z.string(), created: z.record(z.string(), z.unknown()), run_id: z.string().nullable() }),
  "diagnostic.proposed": P({
    company_id: z.string(),
    diagnostic: z.record(z.string(), z.unknown()),
    scores: z.array(z.record(z.string(), z.unknown())),
    evidence: z.array(z.record(z.string(), z.unknown())),
    run_id: z.string().nullable(),
  }),
} as const;

export type EventType = keyof typeof EventPayloads;
export type EventPayload<T extends EventType> = z.infer<(typeof EventPayloads)[T]>;

export type DemoEvent<T extends EventType = EventType> = {
  id: string;
  firm_id: string;
  session_id: string | null;
  actor: string;
  type: T;
  entity_type: string;
  entity_id: string;
  payload: EventPayload<T>;
  at: string;
};

export function parsePayload<T extends EventType>(type: T, payload: unknown): EventPayload<T> {
  return EventPayloads[type].parse(payload) as EventPayload<T>;
}
