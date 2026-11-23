/**
 * Result payloads that cross the flow ↔ screen boundary (`result.data` in the SSE stream,
 * and the shape of the matching data/precomputed/*.json files).
 * Screens import these types; flows must produce exactly these shapes.
 */
import type { DomainSlug } from "@/lib/domain/schemas";
import type { Intent } from "@/lib/domain/program-map";

/** F1 / F2 domain score as stored and rendered. */
export type ScoredDomain = {
  domain: DomainSlug;
  score: 1 | 2 | 3 | 4 | 5 | null;
  confidence: "low" | "medium" | "high";
  finding: string;
  evidence_ids: string[];
};

export type EvidenceItem = {
  id: string;
  claim: string;
  cited_text: string;
  url: string | null;
  title: string;
  /** for document citations: snapshot id and char range */
  location?: { source_id: string; start: number; end: number } | null;
};

export type Synthesis = {
  binding_domain: DomainSlug | null;
  binding_statement: string | null;
  rationale: string;
  evidence_ids: string[];
  questions: string[];
  program_ids: string[];
  lesson_ids: string[];
};

/** F1 result.data — also persisted as a `diagnostic.proposed` event. */
export type DiagnosticResult = {
  diagnostic_id: string;
  company_id: string;
  scores: ScoredDomain[];
  evidence: EvidenceItem[];
  synthesis: Synthesis;
  replayed: boolean;
};

/** F2 persisted run (any_company_runs.result) and result.data. */
export type AnyCompanyResult = {
  run_id: string;
  status: "ok" | "declined" | "ambiguous" | "not_found" | "insufficient";
  identity: { name: string; website: string | null; description: string; vertical: string | null; reason: string };
  candidates: { name: string; website: string | null }[];
  sources: { url: string; title: string }[];
  scores: ScoredDomain[];
  evidence: EvidenceItem[];
  synthesis: Synthesis | null;
  created_at: string;
  reviewed: boolean;
};

/** F4 result.data — proposed matches; applied only via "Use these matches". */
export type LessonMatchResult = {
  lesson_id: string;
  matches: { company_id: string; reason: string; fit: "strong" | "possible" }[];
  excluded: { company_id: string; reason: string }[];
};

/** F5 result.data — the drafted section (text also streamed as tokens). */
export type BoardPackDraft = { pack_id: string; section_key: "letter" | "asks"; content_md: string };

/** F6 draft (stored in shareholder_update.redrafted and data/precomputed/f6-q4.json). */
export type ShareholderSegment =
  | { kind: "text"; text: string }
  | { kind: "ref"; ref: { type: string; id: string; field: string } };
export type ShareholderDraft = {
  quarter: string;
  title: string;
  segments: ShareholderSegment[];
  held_back: { type: string; id: string; reason: string }[];
  draft_n: number;
};

/** F7 result.data. */
export type DayOneResult = {
  deal_id: string;
  company_slug: string;
  binding: { domain: DomainSlug; statement: string };
  priorities: { rank: number; title: string; domain: DomainSlug; intent: Intent; mission: { title: string; operator_role: string; due_weeks: number } }[];
  started: { program_id: string; name: string; hours: number; operator_initials: string; operator_role: string }[];
  deferred: { program_id: string; name: string; reason: string }[];
  hours_started: number;
  hours_total: number;
  partner: { operator_id: string; label: string; seats_used: number; seats_total: number; note: string | null } | null;
  lessons: { id: string; title: string }[];
};

// ── Added by the AI layer (additive; nothing above changed) ──────────────

/** F3: a proposal row under an answer ("needs your approval"). Approve/Dismiss → proposal.approved / proposal.rejected. */
export type CaptainProposal = { proposal_id: string; title: string; detail: string; target: string | null };

/** F3 result.data — one Captain answer. */
export type CaptainAnswer = {
  message_id: string;
  question: string;
  /** Markdown (paragraphs, lists, emphasis, links). ⟦ref:type/id⟧ markers are already removed. */
  text: string;
  /** Number strings in `text` that were not traced to a tool result: render with an amber underline, title "Not traced to a record". */
  untraced: string[];
  /** Record and source chips shown under the answer. */
  refs: import("./sse").Ref[];
  /** "Read {n} records through the Rypples tool registry." */
  records_read: number;
  next_steps: CaptainProposal[];
  /** Caveats the answer carries inline (low confidence / outside benchmark), for tests and chips. */
  caveats: string[];
  /** Answered from precomputed content (cached mode). */
  from_cache: boolean;
  /** Cached mode, question not answerable from precomputed content. */
  paused: { message: string; prompts: string[] } | null;
};

export type CaptainThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  answer: CaptainAnswer | null;
  created_at: string;
};

export type CaptainScopeInput = { kind: "os" } | { kind: "bridge"; slug: string };

/** GET /api/ai/captain?scope=os | ?scope=bridge&slug=… */
export type CaptainBootstrap = {
  scope: CaptainScopeInput;
  company_name: string | null;
  mode: "live" | "cached";
  /** OS only ([] in Bridge). Approve records proposal.approved with proposal_id = id. */
  overnight: {
    id: string;
    what: string;
    state: string;
    route: string;
    action: "approve" | "review" | "none";
    status: "proposed" | "approved" | "rejected";
    at_label: string;
  }[];
  /** Bridge only ([] in OS): "Since you were last here". */
  since_last: { id: string; what: string; route: string; tone: "lime" | "amber" | "neutral" }[];
  /** OS only: the seeded first exchange, shown on first open until "New conversation". */
  seeded: { label: string; answer: CaptainAnswer } | null;
  thread: CaptainThreadMessage[];
  prompts: string[];
  /** Status of every session proposal (Captain next steps and overnight approvals). */
  proposals: Record<string, "proposed" | "approved" | "rejected">;
  connected: { id: string; name: string; demo: boolean; status: "connected" | "available" }[];
  placeholder: string;
  /** actor for act(): "jerome" in OS, "founder:<companyId>" in Bridge */
  actor: "jerome" | `founder:${string}`;
};

/** S5b: one entry in "Recently run" (shared cache). */
export type RecentRun = { run_id: string; name: string; website: string | null; status: AnyCompanyResult["status"]; created_at: string };
