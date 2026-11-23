/**
 * Zod schemas that mirror every seeded table (docs/04-data-model.md).
 * Column names are snake_case so seed JSON maps 1:1 onto Postgres rows.
 * Seed files in data/seed/*.json are validated against these in tests/unit/seed.test.ts.
 */
import { z } from "zod";

export const Provenance = z.enum(["public", "scenario", "illustrative", "generated"]);
export type Provenance = z.infer<typeof Provenance>;

export const DomainSlug = z.enum([
  "commercial",
  "financing",
  "operations",
  "technology",
  "regulatory",
  "people",
  "ai",
  "impact",
]);
export type DomainSlug = z.infer<typeof DomainSlug>;

export const Vertical = z.enum([
  "Ocean Health",
  "Ecosystems",
  "Blue Foods",
  "Maritime",
  "Ocean Intelligence",
]);
export type Vertical = z.infer<typeof Vertical>;

export const Region = z.enum(["Europe", "APAC", "Americas", "Africa", "MENA"]);

const base = {
  id: z.string().min(1),
  firm_id: z.string().default("rypples"),
};
const prov = { provenance: Provenance };

// ── Core ────────────────────────────────────────────────────────────────
export const Firm = z.object({ id: z.string(), name: z.string() });

export const Person = z.object({
  ...base,
  kind: z.enum(["rypples", "founder", "operator"]),
  name: z.string().nullable(),
  title: z.string(),
  initials: z.string(),
  company_id: z.string().nullable().default(null),
  photo_path: z.string().nullable().default(null),
  source_id: z.string().nullable().default(null),
  ...prov,
});

export const Company = z.object({
  ...base,
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  vertical: Vertical.nullable(),
  region: z.string().nullable(),
  stage: z.enum(["Pilots", "First commercial", "Repeatable sales", "Exited"]).nullable(),
  status: z.enum(["active", "exited", "unannounced", "pipeline", "prospect"]),
  website: z.string().url().nullable(),
  public: z.boolean(),
  anchor: z.boolean(),
  board_seat: z.boolean(),
  round_closed_at: z.string().nullable(),
  ceo_person_id: z.string().nullable(),
  codename: z.boolean().default(false),
  rating_seed: z.number().nullable(),
  next_board_label: z.string().nullable(),
  /** board meeting as an offset (days) from the scenario date, when it is relative */
  next_board_offset: z.number().int().nullable().default(null),
  exit_note: z.string().nullable().default(null),
  source_id: z.string().nullable().default(null),
  /** created in a visitor's demo session (F7); never in seed */
  session_added: z.boolean().default(false),
  ...prov,
});
export type Company = z.infer<typeof Company>;

export const Source = z.object({
  ...base,
  url: z.string().url(),
  title: z.string(),
  publisher: z.string(),
  kind: z.enum(["company", "press", "deal", "dataset"]),
  accessed_at: z.string(),
  snapshot_path: z.string().nullable(),
});
export type Source = z.infer<typeof Source>;

export const Fact = z.object({
  ...base,
  company_id: z.string(),
  key: z.string(),
  label: z.string(),
  value: z.string(),
  source_id: z.string().nullable(),
  is_claim: z.boolean().default(false),
  verify_note: z.string().nullable().default(null),
  ...prov,
});

export const DocumentRow = z.object({
  ...base,
  company_id: z.string(),
  source_id: z.string(),
  title: z.string(),
  kind: z.string(),
  ...prov,
});

export const Domain = z.object({
  id: DomainSlug,
  slug: DomainSlug,
  label: z.string(),
  note: z.string(),
  sort: z.number().int(),
});
export type Domain = z.infer<typeof Domain>;

// ── Diagnosis ───────────────────────────────────────────────────────────
export const Diagnostic = z.object({
  ...base,
  company_id: z.string().nullable(),
  run_id: z.string().nullable(),
  kind: z.enum(["board_pack", "public", "diligence", "any_company"]),
  status: z.enum(["proposed", "confirmed", "disputed"]),
  binding_domain_id: DomainSlug.nullable(),
  binding_statement: z.string().nullable(),
  binding_detail: z.string().nullable().default(null),
  questions: z.array(z.string()),
  program_ids: z.array(z.string()),
  lesson_ids: z.array(z.string()),
  confirmed_by: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  confirmed_label: z.string().nullable().default(null),
  prompt_version: z.string().nullable(),
  model: z.string().nullable(),
  ...prov,
});
export type Diagnostic = z.infer<typeof Diagnostic>;

export const DimensionScore = z.object({
  id: z.string(),
  diagnostic_id: z.string(),
  domain_id: DomainSlug,
  score: z.number().int().min(1).max(5).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  finding: z.string(),
  evidence_ids: z.array(z.string()),
  source_ids: z.array(z.string()).default([]),
  is_binding: z.boolean(),
  note: z.string().nullable().default(null),
});
export type DimensionScore = z.infer<typeof DimensionScore>;

export const Evidence = z.object({
  ...base,
  company_id: z.string().nullable(),
  run_id: z.string().nullable(),
  source_id: z.string().nullable(),
  document_id: z.string().nullable(),
  url: z.string().nullable(),
  title: z.string(),
  cited_text: z.string().max(400),
  claim: z.string(),
  location: z.record(z.string(), z.unknown()).nullable(),
  ...prov,
});
export type Evidence = z.infer<typeof Evidence>;

export const CompanyConstraint = z.object({
  ...base,
  company_id: z.string(),
  domain_id: DomainSlug,
  statement: z.string(),
  provisional: z.boolean().default(false),
  /** days the constraint has been open at the scenario date (I), or null to derive from opened_at */
  days_open: z.number().int().nullable(),
  opened_at: z.string().nullable(),
  cleared_at: z.string().nullable(),
  confirmed_by: z.string().nullable(),
  ...prov,
});
export type CompanyConstraint = z.infer<typeof CompanyConstraint>;

export const Benchmark = z.object({
  id: z.string(),
  domain_id: DomainSlug,
  days: z.number().int(),
  source_kind: z.enum(["outside", "blended", "rypples"]),
  source_note: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  ...prov,
});
export type Benchmark = z.infer<typeof Benchmark>;

export const ClearedCase = z.object({
  id: z.string(),
  domain_id: DomainSlug,
  case_label: z.string(),
  cleared_seq: z.number().int(),
  days: z.number().int(),
  cleared_on: z.string(),
  ...prov,
});
export type ClearedCase = z.infer<typeof ClearedCase>;

// ── Growth Engine ───────────────────────────────────────────────────────
export const Program = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  domain_id: DomainSlug,
  length_weeks: z.number().int(),
  hours: z.number().int(),
  outcome: z.string(),
  delivered_by_role: z.string(),
  delivered_by_operator_id: z.string().nullable(),
  running: z.number().int(),
  done: z.number().int(),
  rating: z.number().nullable(),
  ...prov,
});
export type Program = z.infer<typeof Program>;

export const Allocation = z.object({
  ...base,
  company_id: z.string(),
  year: z.number().int(),
  programs_total: z.number().int(),
  hours_total: z.number().int(),
  source: z.literal("term_sheet"),
  ...prov,
});
export type Allocation = z.infer<typeof Allocation>;

export const Enrolment = z.object({
  ...base,
  company_id: z.string(),
  program_id: z.string(),
  label: z.string().nullable().default(null),
  status: z.enum(["proposed", "requested", "running", "done"]),
  state_note: z.string().nullable().default(null),
  week: z.number().int().nullable(),
  of_weeks: z.number().int().nullable(),
  hours: z.number().int(),
  operator_id: z.string().nullable(),
  rating: z.number().nullable(),
  ...prov,
});
export type Enrolment = z.infer<typeof Enrolment>;

export const Operator = z.object({
  ...base,
  initials: z.string(),
  role: z.string(),
  role_key: z.enum(["board_partner", "finance", "gtm", "people", "impact", "technical", "regulatory"]),
  focus: z.string(),
  covers: z.array(z.string()),
  covers_note: z.string().nullable().default(null),
  seats_total: z.number().int().nullable(),
  seats_used: z.number().int().nullable(),
  hours_quarter: z.number().int(),
  hours_committed: z.number().int(),
  rating: z.number(),
  open_missions: z.number().int(),
  delivered: z.number().int(),
  vertical_focus: Vertical.nullable().default(null),
  ...prov,
});
export type Operator = z.infer<typeof Operator>;

export const Mission = z.object({
  ...base,
  company_id: z.string(),
  priority_id: z.string().nullable(),
  title: z.string(),
  operator_id: z.string(),
  due_offset: z.number().int(),
  status: z.string(),
  ...prov,
});
export type Mission = z.infer<typeof Mission>;

export const Commitment = z.object({
  ...base,
  company_id: z.string(),
  title: z.string(),
  from_label: z.string(),
  operator_id: z.string().nullable(),
  due_label: z.string(),
  due_offset: z.number().int().nullable(),
  status: z.enum(["not_started", "in_progress", "open", "delivered"]),
  rating: z.number().int().min(1).max(5).nullable(),
  sort: z.number().int(),
  ...prov,
});
export type Commitment = z.infer<typeof Commitment>;

export const TalentRole = z.object({
  id: z.string(),
  company_id: z.string(),
  role: z.string(),
  why: z.string(),
  state: z.string(),
  ...prov,
});
export const BenchGroup = z.object({ id: z.string(), label: z.string(), n: z.number().int(), ...prov });
export const PartnerRecruiting = z.object({
  id: z.string(),
  role: z.string(),
  state: z.string(),
  note: z.string(),
  ...prov,
});
export const CeoDevelopment = z.object({ id: z.string(), company_id: z.string(), note: z.string(), ...prov });

export const Circle = z.object({
  id: z.string(),
  name: z.string(),
  theme: z.string(),
  session_n: z.number().int(),
  of_n: z.number().int(),
  next_label: z.string(),
  composition_rule: z.string(),
  members: z.array(z.string()),
  exclusions: z.array(z.object({ company_id: z.string(), reason: z.string() })),
  ...prov,
});
export type Circle = z.infer<typeof Circle>;

export const CircleCommitment = z.object({
  id: z.string(),
  circle_id: z.string(),
  company_id: z.string(),
  text: z.string(),
  status: z.enum(["done", "open", "at_risk"]),
  ...prov,
});

export const ReadinessModule = z.object({
  id: z.string(),
  n: z.number().int(),
  name: z.string(),
  outcome: z.string(),
  domain_id: DomainSlug,
});

export const Promise_ = z.object({ id: z.string(), title: z.string(), text: z.string() });

// ── Plans and lifecycle ─────────────────────────────────────────────────
export const Plan = z.object({
  ...base,
  company_id: z.string(),
  from_diagnostic_id: z.string().nullable(),
  status: z.string(),
  ...prov,
});
export const Priority = z.object({
  id: z.string(),
  plan_id: z.string(),
  rank: z.number().int(),
  title: z.string(),
  domain_id: DomainSlug,
  progress_note: z.string().nullable().default(null),
});
export const LifecycleStage = z.object({
  id: z.string(),
  company_id: z.string(),
  key: z.enum(["day0", "first100", "quarterly", "strategic"]),
  status: z.enum(["done", "in_progress", "upcoming", "always_on"]),
  label: z.string(),
  when: z.string(),
  note: z.string(),
  founder_note: z.string().nullable().default(null),
  ...prov,
});
export type LifecycleStage = z.infer<typeof LifecycleStage>;

export const BoardMeeting = z.object({
  id: z.string(),
  company_id: z.string(),
  at: z.string().nullable(),
  at_offset: z.number().int().nullable(),
  label: z.string(),
  note: z.string().nullable(),
  kind: z.enum(["past", "next"]),
});

export const Decision = z.object({
  ...base,
  company_id: z.string().nullable(),
  context_label: z.string(),
  question: z.string(),
  line: z.string(),
  action_label: z.string(),
  route: z.string(),
  status: z.enum(["open", "resolved"]),
  sort: z.number().int(),
  ...prov,
});
export type Decision = z.infer<typeof Decision>;

export const AgendaItem = z.object({
  ...base,
  at_offset: z.number().int(),
  title: z.string(),
  note: z.string(),
  route: z.string(),
  ...prov,
});

export const TechnicalRisk = z.object({
  id: z.string(),
  company_id: z.string(),
  risk: z.string(),
  test: z.string(),
  state: z.string(),
  amber: z.boolean(),
  ...prov,
});

// ── Playbook ────────────────────────────────────────────────────────────
export const TimelineEntry = z.object({
  date: z.string(),
  label: z.string(),
  event: z.string(),
  source_id: z.string().nullable(),
  provenance: Provenance,
  verify_note: z.string().nullable().default(null),
});

export const Lesson = z.object({
  ...base,
  title: z.string(),
  domain_id: DomainSlug,
  learned_in: z.string(),
  play: z.array(z.string()),
  timeline: z.array(TimelineEntry),
  source_ids: z.array(z.string()),
  status: z.enum(["proposed", "approved", "rejected"]),
  approved_by: z.string().nullable(),
  in_library: z.boolean(),
  sent: z.number().int().nullable(),
  helped: z.number().int().nullable(),
  ...prov,
});
export type Lesson = z.infer<typeof Lesson>;

export const LessonMatch = z.object({
  id: z.string(),
  lesson_id: z.string(),
  company_id: z.string(),
  reason: z.string(),
  fit: z.enum(["strong", "possible"]),
  status: z.enum(["matched", "sent"]),
  reason_provenance: Provenance,
  verify_note: z.string().nullable().default(null),
});
export type LessonMatch = z.infer<typeof LessonMatch>;

export const IntakeSession = z.object({
  ...base,
  kind: z.enum(["board", "expert", "circle"]),
  title: z.string(),
  who_label: z.string(),
  held_offset: z.number().int(),
  outcome: z.string(),
  confidential: z.boolean(),
  cta: z.enum(["Review", "Open"]),
  proposed_lesson: z
    .object({ id: z.string(), title: z.string(), domain_id: DomainSlug })
    .nullable(),
  actions: z.array(z.string()),
  ...prov,
});

export const ReplayStep = z.object({
  id: z.string(),
  lesson_id: z.string(),
  at: z.string(),
  label: z.string(),
  event: z.string(),
  source_id: z.string().nullable(),
  platform_read: z.string(),
});

// ── Pipeline ────────────────────────────────────────────────────────────
export const DealStage = z.enum(["sourced", "first_meeting", "diligence", "ic", "led"]);
export type DealStage = z.infer<typeof DealStage>;

export const Deal = z.object({
  ...base,
  codename: z.string(),
  vertical: Vertical,
  region: z.string(),
  stage: DealStage,
  note: z.string(),
  what: z.string(),
  proposed_constraint: z.string(),
  constraint_domain_id: DomainSlug.nullable(),
  why: z.string(),
  evidence_count: z.number().int(),
  plan_drafts: z.array(z.string()),
  partner_note: z.string(),
  lesson_note: z.string(),
  cta_label: z.string(),
  diligence: z
    .object({
      evidence: z.array(z.object({ id: z.string(), claim: z.string(), cited_text: z.string(), title: z.string() })),
      scores: z.array(
        z.object({
          domain_id: DomainSlug,
          score: z.number().int().min(1).max(5).nullable(),
          confidence: z.enum(["low", "medium", "high"]),
          finding: z.string(),
          evidence_ids: z.array(z.string()),
        }),
      ),
    })
    .nullable(),
  data_room: z.array(z.object({ name: z.string(), type: z.string(), modified: z.string() })).default([]),
  ...prov,
});
export type Deal = z.infer<typeof Deal>;

export const SourcingSignal = z.object({
  id: z.string(),
  codename: z.string(),
  vertical: Vertical,
  region: z.string(),
  signal: z.string(),
  ...prov,
});

// ── Bridge ──────────────────────────────────────────────────────────────
export const BoardPackSection = z.object({
  id: z.string(),
  pack_id: z.string(),
  key: z.enum(["letter", "fin", "pilots", "plan", "asks", "ops"]),
  sort: z.number().int(),
  name: z.string(),
  state: z.enum(["needs", "ready", "drafted"]),
  state_label: z.string(),
  kicker: z.string(),
  title: z.string(),
  source_note: z.string(),
  paragraphs: z.array(z.string()),
  rows: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().nullable().default(null) })),
  needs: z.boolean(),
  need_text: z.string().nullable(),
  need_cta: z.string().nullable(),
  ...prov,
});
export type BoardPackSection = z.infer<typeof BoardPackSection>;

export const BoardPack = z.object({
  id: z.string(),
  company_id: z.string(),
  quarter: z.string(),
  meeting_offset: z.number().int(),
  status: z.enum(["drafting", "shared"]),
  share_statements: z.array(z.string()),
  ...prov,
});

export const CapitalLayer = z.object({
  id: z.string(),
  company_id: z.string(),
  sort: z.number().int(),
  name: z.string(),
  who: z.string(),
  status: z.string(),
  ledger_commitment_id: z.string().nullable().default(null),
  ...prov,
});

export const Instrument = z.object({
  id: z.string(),
  company_id: z.string(),
  key: z.string(),
  name: z.string(),
  why: z.string(),
  shortlisted: z.boolean(),
  ...prov,
});

export const Pilot = z.object({
  id: z.string(),
  company_id: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  /** 0 = not yet piloting; 1 Pilot, 2 Terms, 3 Contract, 4 Multi-site */
  stage: z.number().int().min(0).max(4),
  source_id: z.string().nullable(),
  board_label: z.string(),
  ...prov,
});
export type Pilot = z.infer<typeof Pilot>;

// ── Reporting ───────────────────────────────────────────────────────────
export const ImpactKpi = z.object({
  id: z.string(),
  company_id: z.string(),
  kpi: z.string(),
  status: z.enum(["reported", "in_progress", "not_yet"]),
  ...prov,
});
export const StrategicPath = z.object({
  id: z.string(),
  company_id: z.string(),
  now: z.string(),
  now_provenance: Provenance,
  now_source_id: z.string().nullable(),
  likely: z.string(),
  program_status: z.string(),
  verify_note: z.string().nullable().default(null),
});

export const CaptainOvernight = z.object({
  id: z.string(),
  what: z.string(),
  state: z.string(),
  route: z.string(),
  action: z.enum(["approve", "review", "none"]),
});

export const IntegrationReg = z.object({
  id: z.string(),
  name: z.string(),
  system: z.string(),
  demo: z.boolean(),
  status: z.enum(["connected", "available"]),
});

/** Every seed file and the schema used to validate it. */
export const SeedFiles = {
  firms: z.array(Firm),
  people: z.array(Person),
  companies: z.array(Company),
  sources: z.array(Source),
  facts: z.array(Fact),
  documents: z.array(DocumentRow),
  domains: z.array(Domain),
  diagnostics: z.array(Diagnostic),
  dimension_scores: z.array(DimensionScore),
  evidence: z.array(Evidence),
  company_constraints: z.array(CompanyConstraint),
  benchmarks: z.array(Benchmark),
  cleared_cases: z.array(ClearedCase),
  programs: z.array(Program),
  allocations: z.array(Allocation),
  enrolments: z.array(Enrolment),
  operators: z.array(Operator),
  missions: z.array(Mission),
  commitments: z.array(Commitment),
  talent_roles: z.array(TalentRole),
  bench_groups: z.array(BenchGroup),
  partner_recruiting: z.array(PartnerRecruiting),
  ceo_development: z.array(CeoDevelopment),
  circles: z.array(Circle),
  circle_commitments: z.array(CircleCommitment),
  readiness_modules: z.array(ReadinessModule),
  promises: z.array(Promise_),
  plans: z.array(Plan),
  priorities: z.array(Priority),
  lifecycle_stages: z.array(LifecycleStage),
  board_meetings: z.array(BoardMeeting),
  decisions: z.array(Decision),
  agenda_items: z.array(AgendaItem),
  technical_risks: z.array(TechnicalRisk),
  lessons: z.array(Lesson),
  lesson_matches: z.array(LessonMatch),
  intake_sessions: z.array(IntakeSession),
  replay_steps: z.array(ReplayStep),
  deals: z.array(Deal),
  sourcing_signals: z.array(SourcingSignal),
  board_packs: z.array(BoardPack),
  board_pack_sections: z.array(BoardPackSection),
  capital_layers: z.array(CapitalLayer),
  instruments: z.array(Instrument),
  pilots: z.array(Pilot),
  impact_kpis: z.array(ImpactKpi),
  strategic_paths: z.array(StrategicPath),
  captain_overnight: z.array(CaptainOvernight),
  integrations: z.array(IntegrationReg),
} as const;

export type SeedFileName = keyof typeof SeedFiles;
export type Seed = { [K in SeedFileName]: z.infer<(typeof SeedFiles)[K]> };
