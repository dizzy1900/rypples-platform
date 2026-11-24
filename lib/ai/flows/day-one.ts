/**
 * F7 · Signed becomes day one (docs/07-ai.md F7). One structured AI step (the plan; precomputed in
 * cached mode), then deterministic allocation, partner match, schedule, Bridge workspace and lessons,
 * written as one `deal.led` event that carries every created record.
 */
import "server-only";
import { appendEvent, getState, type State } from "@/lib/data";
import type { LedCreated } from "@/lib/data/state";
import type { Deal } from "@/lib/domain/schemas";
import { allocate, ALLOCATION_LIMITS, boardCandidateFor } from "@/lib/domain/capacity";
import { programForIntent } from "@/lib/domain/program-map";
import { isoDate, offsetDate, offsetLabel, fullDate, scenarioDate } from "@/lib/scenario";
import { plain, structuredCall } from "../client";
import { section, tone } from "../prompts";
import { DayOneInput, DayOnePlan, DayOnePlanJson, normalizePlan, planIssues, type DayOnePlanT } from "../schemas/day-one";
import { precomputed } from "../precomputed";
import { pace } from "../replay";
import type { FlowEvent } from "../sse";
import type { DayOneResult } from "../types";
import { FALLBACK_MESSAGE, type FallbackReason, type FlowDef, type FlowRun } from "../runner";

type Input = { dealId: string };
const FIRST_BOARD_DAYS = 30;

const ROLE_TO_OPERATOR: Record<string, string> = {
  "Finance expert": "fe",
  "Go-To-Market expert": "ge",
  "People expert": "pe",
  "Impact expert": "ie",
  "Independent technical expert": "te",
};

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);

/** Approved lessons in a priority's domain whose title speaks to the binding constraint. */
export function lessonsFor(s: State, plan: DayOnePlanT): { id: string; title: string }[] {
  const domains = new Set(plan.priorities.map((p) => p.domain));
  const label = s.domains.find((d) => d.slug === plan.binding.domain)?.label ?? plan.binding.domain;
  const binding = words(`${plan.binding.statement} ${label}`);
  return s.lessons
    .filter((l) => l.status === "approved" && domains.has(l.domain_id))
    .filter((l) => [...words(l.title)].some((w) => binding.has(w)))
    .map((l) => ({ id: l.id, title: l.title }));
}

function dealSlug(deal: Deal) {
  return deal.id;
}

/** Steps 2-6: deterministic. Returns the events to stream, the created records and the result. */
export function buildDayOne(s: State, deal: Deal, plan: DayOnePlanT, sessionId: string) {
  const slug = dealSlug(deal);
  const today = isoDate(scenarioDate());
  const vertical = deal.vertical;
  const ranked = [...plan.priorities].sort((a, b) => a.rank - b.rank);

  // 2 · allocation
  const candidates = ranked.map((p) => programForIntent(p.intent));
  const { decisions, hoursStarted } = allocate(candidates, s.programs, s.operators, ALLOCATION_LIMITS);
  const prog = (id: string) => s.programs.find((p) => p.id === id)!;
  const op = (id: string | null) => s.operators.find((o) => o.id === id) ?? null;
  const started = decisions.filter((d) => d.start).map((d) => ({ program_id: d.program_id, name: prog(d.program_id).name, hours: d.hours, operator_initials: op(d.operator_id)?.initials ?? "", operator_role: op(d.operator_id)?.role ?? "" }));
  const deferred = decisions.filter((d): d is Extract<typeof d, { start: false }> => !d.start).map((d) => ({ program_id: d.program_id, name: prog(d.program_id).name, reason: d.reason.charAt(0).toUpperCase() + d.reason.slice(1) }));

  // 3 · partner: board-level partners are external and look after one company each, so day one moves
  // the candidate lined up for this deal into onboarding. Captain assembles the context pack now.
  const bp = boardCandidateFor(s.operators, deal.id, vertical);
  const partner = bp
    ? {
        operator_id: bp.id,
        label: `${bp.focus} board-level partner`,
        stage: "onboarding" as const,
        note: "Context pack assembled by Captain. Playbook briefing before the first board.",
      }
    : null;

  // 4-5 · schedule and Bridge workspace
  const companyId = slug;
  const founderId = `${slug}-ceo`;
  const diagId = `diag-${slug}-diligence`;
  const planId = `plan-${slug}`;
  const priorities = ranked.map((p) => ({ id: `pri-${slug}-${p.rank}`, plan_id: planId, rank: p.rank, title: p.title, domain_id: p.domain, progress_note: null }));
  const missions = ranked.map((p) => ({
    id: `mis-${slug}-${p.rank}`,
    firm_id: "rypples",
    company_id: companyId,
    priority_id: `pri-${slug}-${p.rank}`,
    title: p.mission.title,
    operator_id: p.mission.operator_role === "Board-level partner" ? (partner?.operator_id ?? "bp-maritime") : (ROLE_TO_OPERATOR[p.mission.operator_role] ?? "pe"),
    due_offset: p.mission.due_weeks * 7,
    status: "open",
    provenance: "generated" as const,
  }));
  const startedDecisions = decisions.filter((d): d is Extract<typeof d, { start: true }> => d.start);
  const enrolments = startedDecisions.map((d) => ({
    id: `enr-${slug}-${d.program_id}`,
    firm_id: "rypples",
    company_id: companyId,
    program_id: d.program_id,
    label: null,
    status: "running" as const,
    state_note: "started on day one",
    week: 1,
    of_weeks: prog(d.program_id).length_weeks,
    hours: d.hours,
    operator_id: d.operator_id,
    rating: null,
    provenance: "generated" as const,
  }));
  const commitments = [
    ...startedDecisions.map((d, i) => {
      const pri = ranked.find((p) => programForIntent(p.intent) === d.program_id);
      const o = op(d.operator_id);
      const due = (pri?.mission.due_weeks ?? prog(d.program_id).length_weeks) * 7;
      return {
        id: `l-${slug}-${d.program_id}`,
        firm_id: "rypples",
        company_id: companyId,
        title: pri?.mission.title ?? prog(d.program_id).name,
        from_label: o?.role ?? "Rypples",
        operator_id: d.operator_id,
        due_label: offsetLabel(due),
        due_offset: due,
        status: "in_progress" as const,
        rating: null,
        sort: i + 1,
        provenance: "generated" as const,
      };
    }),
    {
      id: `l-${slug}-board-rhythm`,
      firm_id: "rypples",
      company_id: companyId,
      title: "Board rhythm agreed for the first 100 days",
      from_label: "Board-level partner",
      operator_id: partner?.operator_id ?? null,
      due_label: offsetLabel(FIRST_BOARD_DAYS),
      due_offset: FIRST_BOARD_DAYS,
      status: "not_started" as const,
      rating: null,
      sort: startedDecisions.length + 1,
      provenance: "generated" as const,
    },
  ];
  const end100 = offsetDate(100);
  const lifecycle = [
    { id: `ls-${slug}-day0`, company_id: companyId, key: "day0" as const, status: "done" as const, label: "Day 0", when: `${fullDate(scenarioDate())} · done`, note: "The diligence diagnostic became the plan. Growth Engine allocation agreed in the term sheet.", founder_note: null, provenance: "generated" as const },
    { id: `ls-${slug}-first100`, company_id: companyId, key: "first100" as const, status: "in_progress" as const, label: "First 100 days", when: `Until ${fullDate(end100)} · in progress`, note: `Constraint confirmed. ${started.map((x) => x.name).join(" and ")} starting. Board rhythm to agree.`, founder_note: null, provenance: "generated" as const },
    { id: `ls-${slug}-quarterly`, company_id: companyId, key: "quarterly" as const, status: "upcoming" as const, label: "Quarterly loop", when: "After the first 100 days", note: "Board pack, diagnostic, programs, Playbook. Every quarter, same rhythm.", founder_note: null, provenance: "generated" as const },
    { id: `ls-${slug}-strategic`, company_id: companyId, key: "strategic" as const, status: "always_on" as const, label: "Exit readiness", when: "Always on", note: "Strategic buyer and acquirer map kept current from day 0.", founder_note: null, provenance: "generated" as const },
  ];
  const board_meetings = [{ id: `bm-${slug}-first`, company_id: companyId, at: null, at_offset: FIRST_BOARD_DAYS, label: offsetLabel(FIRST_BOARD_DAYS), note: "First board: agree the board rhythm and the plan", kind: "next" as const }];
  const diligence = deal.diligence;
  const created: LedCreated = {
    company: {
      id: companyId,
      firm_id: "rypples",
      slug,
      name: deal.codename,
      tagline: deal.what,
      vertical,
      region: deal.region,
      stage: "First commercial",
      status: "active",
      website: null,
      public: false,
      anchor: true,
      board_seat: true,
      round_closed_at: today,
      ceo_person_id: founderId,
      codename: true,
      rating_seed: null,
      next_board_label: offsetLabel(FIRST_BOARD_DAYS),
      next_board_offset: FIRST_BOARD_DAYS,
      exit_note: null,
      source_id: null,
      session_added: true,
      provenance: "illustrative",
    },
    constraint: { id: `cc-${slug}`, firm_id: "rypples", company_id: companyId, domain_id: plan.binding.domain, statement: plan.binding.statement, provisional: false, days_open: null, opened_at: today, cleared_at: null, confirmed_by: "jerome", provenance: "illustrative" },
    plan: { id: planId, firm_id: "rypples", company_id: companyId, from_diagnostic_id: diagId, status: "active", provenance: "generated" },
    priorities,
    missions,
    allocation: { id: `alloc-${slug}-${today.slice(0, 4)}`, firm_id: "rypples", company_id: companyId, year: Number(today.slice(0, 4)), programs_total: ALLOCATION_LIMITS.programs, hours_total: ALLOCATION_LIMITS.hours, source: "term_sheet", provenance: "illustrative" },
    enrolments,
    commitments,
    lifecycle,
    board_meetings,
    founder: { id: founderId, firm_id: "rypples", kind: "founder", name: null, title: `CEO, ${deal.codename}`, initials: deal.codename.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), company_id: companyId, photo_path: null, source_id: null, provenance: "illustrative" },
    operator_updates: [
      ...(partner ? [{ operator_id: partner.operator_id, stage: partner.stage, stage_note: `Onboarding for ${deal.codename}'s board. Context pack sent.`, onboarding_done: ["context_pack" as const] }] : []),
      ...startedDecisions.map((d) => ({ operator_id: d.operator_id, hours_committed: (op(d.operator_id)?.hours_committed ?? 0) + d.hours })),
    ],
    lesson_ids: lessonsFor(s, plan).map((l) => l.id),
    deferred: deferred.map((d) => ({ program_id: d.program_id, reason: d.reason })),
    diagnostic: {
      id: diagId,
      firm_id: "rypples",
      company_id: companyId,
      run_id: null,
      kind: "diligence",
      status: "confirmed",
      binding_domain_id: plan.binding.domain,
      binding_statement: plan.binding.statement,
      binding_detail: deal.why,
      questions: [],
      program_ids: started.map((x) => x.program_id),
      lesson_ids: lessonsFor(s, plan).map((l) => l.id),
      confirmed_by: "jerome",
      confirmed_at: today,
      confirmed_label: "Confirmed at investment committee",
      prompt_version: null,
      model: null,
      provenance: "illustrative",
    },
    scores: (diligence?.scores ?? []).map((x) => ({ id: `${diagId}-${x.domain_id}`, diagnostic_id: diagId, domain_id: x.domain_id, score: x.score, confidence: x.confidence, finding: x.finding, evidence_ids: x.evidence_ids, source_ids: [], is_binding: x.domain_id === plan.binding.domain, note: null })),
  };
  const lessons = lessonsFor(s, plan);
  const result: DayOneResult = {
    deal_id: deal.id,
    company_slug: slug,
    binding: plan.binding,
    priorities: ranked,
    started,
    deferred,
    hours_started: hoursStarted,
    hours_total: ALLOCATION_LIMITS.hours,
    partner,
    lessons,
  };
  const steps: [string, string][] = [
    ["allocation", `${started.map((x) => `${x.name} ${x.hours}h`).join(" + ")} = ${hoursStarted}/${ALLOCATION_LIMITS.hours}`],
    ["partner", partner ? `${partner.label} moves to onboarding for ${deal.codename}'s board` : "No board-level candidate yet: start sourcing"],
    ["schedule", `First board ${offsetLabel(FIRST_BOARD_DAYS)}`],
    ["bridge", `Rypples Engine opened for the CEO of ${deal.codename}`],
    ["lessons", lessons.length ? lessons.map((l) => l.title).join("; ") : "No matching lessons"],
  ];
  void sessionId;
  return { created, result, steps };
}

async function* execute(run: FlowRun<Input>, s: State, deal: Deal, plan: DayOnePlanT): AsyncGenerator<FlowEvent> {
  const { created, result, steps } = buildDayOne(s, deal, plan, run.sessionId);
  for (const [key, detail] of steps) {
    yield { type: "step", key, state: "running" };
    await pace(600);
    yield { type: "step", key, state: "done", detail };
  }
  await appendEvent({
    sessionId: run.sessionId,
    actor: "jerome",
    type: "deal.led",
    entityType: "deal",
    entityId: deal.id,
    payload: { deal_id: deal.id, created: created as unknown as Record<string, unknown>, run_id: run.runId },
  });
  yield { type: "result", id: deal.id, data: result };
}

async function dealFor(run: FlowRun<Input>) {
  const s = await getState(run.sessionId);
  const deal = s.deals.find((d) => d.id === run.input.dealId);
  if (!deal) throw new Error("Unknown deal");
  return { s, deal };
}

async function* live(run: FlowRun<Input>): AsyncGenerator<FlowEvent> {
  run.meta.promptVersion = "day-one@v1";
  const { s, deal } = await dealFor(run);
  if (s.extras.ledResults[deal.id]) {
    yield { type: "error", message: `${deal.codename} is already led in this session.` };
    return;
  }
  if (!deal.diligence || !deal.constraint_domain_id) throw new Error("Diligence isn't complete for this deal");
  yield { type: "step", key: "plan", state: "running" };
  const evidence = deal.diligence.evidence.map((e) => `[${e.id}] ${e.claim}: "${e.cited_text}" (${e.title})`).join("\n");
  const scores = deal.diligence.scores.map((x) => `- ${x.domain_id}: ${x.score ?? "null"} (${x.confidence}) ${x.finding}`).join("\n");
  const plan = await structuredCall(run.tracker, {
    task: "f7",
    system: [plain(`${tone()}\n\n${section("day-one", "plan", { codename: deal.codename, binding_domain: deal.constraint_domain_id, binding_statement: deal.proposed_constraint })}`)],
    messages: [{ role: "user", content: `${deal.codename}: ${deal.what}\nWhy: ${deal.why}\n\nDiligence scores:\n${scores}\n\nEvidence:\n${evidence}\n\nDraft priorities from IC:\n${deal.plan_drafts.map((p) => `- ${p}`).join("\n")}` }],
    max_tokens: 1500,
    effort: "medium",
    signal: run.signal,
    schema: DayOnePlan,
    jsonSchema: DayOnePlanJson,
    normalize: normalizePlan,
    check: (p) => planIssues(p, deal.constraint_domain_id!),
  });
  if (planIssues(plan, deal.constraint_domain_id).length) throw new Error("Plan failed validation");
  run.meta.capture = { plan };
  yield { type: "step", key: "plan", state: "done", detail: `Binding: ${plan.binding.statement}` };
  yield* execute(run, s, deal, plan);
}

async function* cachedRun(run: FlowRun<Input>, reason: FallbackReason): AsyncGenerator<FlowEvent> {
  const f = precomputed.f7;
  const { s, deal } = await dealFor(run);
  if (deal.id !== f.deal_id) {
    yield { type: "fallback", reason, replaying: false, message: "Live runs are paused for today." };
    return;
  }
  if (s.extras.ledResults[deal.id]) {
    yield { type: "error", message: `${deal.codename} is already led in this session.` };
    return;
  }
  run.meta.precomputed = true;
  yield { type: "fallback", reason, replaying: true, message: FALLBACK_MESSAGE[reason] };
  yield { type: "step", key: "plan", state: "running" };
  await pace(1000);
  yield { type: "step", key: "plan", state: "done", detail: `Binding: ${f.plan.binding.statement}` };
  yield* execute(run, s, deal, f.plan);
}

export const dayOneFlow: FlowDef<Input> = {
  flow: "day-one",
  input: DayOneInput,
  surface: () => "day-one",
  live,
  cached: cachedRun,
};
