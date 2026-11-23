import type { State } from "../state";
import type { DomainSlug, Provenance } from "@/lib/domain/schemas";
import { firmCapacity, hoursLeft, operatorLoad, tightestOperator } from "@/lib/domain/capacity";
import { effectiveBenchmark } from "@/lib/domain/benchmarks";
import { daysOpen, isActiveNamed, openConstraint } from "@/lib/domain/portfolio-stats";
import { offsetLabel, numberWord } from "@/lib/scenario";

export const ENGINE_TABS = [
  { key: "programs", label: "Programs" },
  { key: "partners", label: "Operating partners" },
  { key: "talent", label: "Talent" },
  { key: "scalers", label: "Ocean Scalers" },
  { key: "readiness", label: "Growth Readiness" },
] as const;
export type EngineTab = (typeof ENGINE_TABS)[number]["key"];

const fmt = (n: number) => n.toLocaleString("en-GB");
const domainLabel = (s: State, d: string) => s.domains.find((x) => x.slug === d)?.label ?? d;

// ── Programs ───────────────────────────────────────────────────────────
export function getPrograms(s: State) {
  const opById = new Map(s.operators.map((o) => [o.id, o]));
  const rows = s.programs.map((p) => {
    const enrolled = s.enrolments
      .filter((e) => e.program_id === p.id && e.status !== "proposed")
      .map((e) => {
        const c = s.companies.find((c) => c.id === e.company_id);
        return {
          companyId: e.company_id,
          slug: c?.slug ?? e.company_id,
          name: c?.name ?? e.company_id,
          label: e.label,
          status: e.status,
          progress: e.week && e.of_weeks ? `Week ${e.week} of ${e.of_weeks}` : e.state_note,
        };
      });
    const proposed = s.enrolments.filter((e) => e.program_id === p.id && e.status === "proposed").map((e) => s.companies.find((c) => c.id === e.company_id)?.name ?? e.company_id);
    const op = p.delivered_by_operator_id ? opById.get(p.delivered_by_operator_id) : null;
    return {
      id: p.id,
      name: p.name,
      outcome: p.outcome,
      domain: domainLabel(s, p.domain_id),
      weeks: p.length_weeks,
      hours: p.hours,
      deliveredBy: p.delivered_by_role,
      operator: op ? { initials: op.initials, role: op.role } : null,
      running: s.enrolments.filter((e) => e.program_id === p.id && e.status === "running").length,
      done: p.done,
      rating: p.rating,
      provenance: p.provenance as Provenance,
      enrolled,
      proposed,
    };
  });
  const cap = firmCapacity(s.operators);
  const tight = tightestOperator(s.operators);
  const alloc = s.allocations[0];
  return {
    rows,
    allocationCopy: alloc
      ? `Each Anchor company gets ${numberWord(alloc.programs_total).toLowerCase()} programs and ${alloc.hours_total} operator hours a year, paid for from Rypples' balance sheet. The founder chooses which programs. Delivery shows up in their ledger, and they rate it.`
      : null,
    capacity: { line: `${fmt(cap.committed)} of ${fmt(cap.total)} operator hours committed`, pct: cap.pct },
    tightest: tight
      ? {
          role: tight.role,
          pct: Math.round(operatorLoad(tight) * 100),
          note: tight.covers_note,
          left: hoursLeft(tight),
        }
      : null,
  };
}

// ── Operating partners ─────────────────────────────────────────────────
const QUESTIONS: Record<DomainSlug, [string, string, string]> = {
  commercial: [
    "Who signs, who pays and who can block this deal?",
    "What would turn the current pilot into a purchase order, and by when?",
    "Which buyer reference would change the next conversation?",
  ],
  financing: [
    "What does the asset look like to a lender, and what is the downside case?",
    "Who has already seen the numbers, and what did they push back on?",
    "Which first-loss or grant layer would unlock the senior capital?",
  ],
  operations: [
    "What has to be true for the next unit to be delivered on time?",
    "Where is delivery capacity short today: people, parts or partners?",
    "What would an early warning of delay look like?",
  ],
  technology: [
    "What evidence would a buyer or lender accept as independent proof?",
    "Which field data exists today, and where are the gaps?",
    "What failure would end a pilot early?",
  ],
  regulatory: [
    "Which approvals gate the first commercial sale, and who owns each?",
    "What are the lead times by market, and which is on the critical path?",
    "What would change the plan if an approval slips by a quarter?",
  ],
  people: [
    "What must this person have done before to succeed here?",
    "Where is the search now, and what is stopping a decision?",
    "What does the first 90 days of this hire need to deliver?",
  ],
  ai: [
    "Which operating workflow costs the most time every week?",
    "What data does it need, and is that data already clean?",
    "How will the team know it works after four weeks?",
  ],
  impact: [
    "Which Ocean Impact Navigator measure matters most to this company's buyers?",
    "What data is already collected, and who signs it off?",
    "What would a first verified report need to show?",
  ],
};

export type MissionBrief = {
  id: string;
  title: string;
  company: { name: string; slug: string };
  operator: string;
  due: string;
  context: string;
  constraint: string | null;
  lessons: { title: string; learnedIn: string }[];
  domain: string;
  questions: string[];
};

export function getPartners(s: State) {
  const name = (id: string) => s.companies.find((c) => c.id === id)?.name ?? id;
  const roster = s.operators.map((o) => ({
    id: o.id,
    initials: o.initials,
    role: o.role,
    focus: o.focus,
    covers: o.covers.map(name),
    open: o.open_missions,
    delivered: o.delivered,
    rating: o.rating,
    load: operatorLoad(o),
    loadPct: Math.round(operatorLoad(o) * 100),
    hours: `${o.hours_committed} of ${o.hours_quarter} h`,
    seats: o.seats_total != null ? `${o.seats_used ?? 0} of ${o.seats_total} seats` : null,
    note: o.covers_note,
  }));

  const missions: MissionBrief[] = s.missions
    .filter((m) => m.status === "open")
    .sort((a, b) => a.due_offset - b.due_offset)
    .map((m) => {
      const op = s.operators.find((o) => o.id === m.operator_id);
      const co = s.companies.find((c) => c.id === m.company_id);
      const k = openConstraint(s, m.company_id);
      const pri = m.priority_id ? s.priorities.find((p) => p.id === m.priority_id) : null;
      const domain = (pri?.domain_id ?? k?.domain_id ?? "commercial") as DomainSlug;
      const b = k ? effectiveBenchmark(k.domain_id, s.benchmarks, s.cleared_cases) : null;
      const d = k ? daysOpen(k) : null;
      const lessons = s.lessons
        .filter((l) => l.status === "approved" && l.domain_id === domain)
        .map((l) => ({ title: l.title, learnedIn: l.learned_in }));
      return {
        id: m.id,
        title: m.title,
        company: { name: co?.name ?? m.company_id, slug: co?.slug ?? m.company_id },
        operator: op ? `${op.role} (${op.initials})` : "Unassigned",
        due: offsetLabel(m.due_offset),
        context: `${op?.role ?? "An operator"} is working with ${co?.name ?? m.company_id} on "${m.title}", due ${offsetLabel(m.due_offset)}.${pri ? ` It serves priority ${pri.rank}: ${pri.title}.` : ""}`,
        constraint: k
          ? `${domainLabel(s, k.domain_id)}: ${k.statement}${d != null && b ? ` Open ${d} days against a ${b.days}-day benchmark.` : ""}`
          : null,
        lessons,
        domain: domainLabel(s, domain),
        questions: QUESTIONS[domain],
      };
    });

  const onboarding = s.partner_recruiting.find((r) => r.state.toLowerCase() === "onboarding");
  return {
    roster,
    missions,
    recruiting: s.partner_recruiting.map((r) => ({ id: r.id, role: r.role, state: r.state, note: r.note })),
    onboardingNote: onboarding
      ? `New operators get a Playbook briefing before their first mission. ${onboarding.role}: ${onboarding.note}`
      : "New operators get a Playbook briefing before their first mission.",
  };
}

// ── Talent ─────────────────────────────────────────────────────────────
export function getTalent(s: State) {
  const bench = s.bench_groups.map((g) => ({ id: g.id, label: g.label, n: g.n }));
  const ceo = s.ceo_development[0];
  const ceoCompany = ceo ? s.companies.find((c) => c.id === ceo.company_id) : null;
  const ceoPerson = ceoCompany ? s.people.find((p) => p.id === ceoCompany.ceo_person_id) : null;
  return {
    roles: s.talent_roles.map((r) => {
      const c = s.companies.find((c) => c.id === r.company_id);
      return { id: r.id, role: r.role, company: c?.name ?? r.company_id, slug: c?.slug ?? r.company_id, why: r.why, state: r.state };
    }),
    bench,
    benchTotal: bench.reduce((a, g) => a + g.n, 0),
    ceo: ceo ? { who: ceoPerson?.name ?? ceoCompany?.name ?? "", note: ceo.note, company: ceoCompany?.name ?? "" } : null,
  };
}

// ── Ocean Scalers ──────────────────────────────────────────────────────
const stageRank = (st: string | null) => (st === "Pilots" ? 0 : st === "First commercial" ? 1 : st === "Repeatable sales" ? 2 : st === "Exited" ? 3 : -1);

export function getScalers(s: State) {
  const circle = s.circles.find((c) => c.id === "circle-02") ?? s.circles[0];
  if (!circle) return null;
  const co = (id: string) => s.companies.find((c) => c.id === id);
  const nm = (id: string) => co(id)?.name ?? id;
  const members = circle.members.map((id) => ({ id, slug: co(id)?.slug ?? id, name: nm(id), vertical: co(id)?.vertical ?? null, region: co(id)?.region ?? null, stage: co(id)?.stage ?? null }));
  const circleStage = Math.min(...members.map((m) => stageRank(m.stage)).filter((r) => r >= 0));
  const circleStageName = members.find((m) => stageRank(m.stage) === circleStage)?.stage ?? "";

  const validate = (inId: string, outId: string | null): string[] => {
    const problems: string[] = [];
    const cand = co(inId);
    const ex = circle.exclusions.find((e) => e.company_id === inId);
    let excluded = false;
    if (ex) {
      const m = ex.reason.match(/^Same market as ([^:,]+)/);
      const conflict = m?.[1]?.trim();
      const resolved = !!(outId && conflict && nm(outId) === conflict);
      if (!resolved) {
        problems.push(ex.reason);
        excluded = true;
      }
    }
    if (!excluded && cand && stageRank(cand.stage) < circleStage) {
      problems.push(`Still at ${cand.stage?.toLowerCase()} stage; the circle is at ${circleStageName.toLowerCase()}`);
    }
    if (outId) {
      const after = circle.members.filter((m) => m !== outId).concat(inId);
      const verticals = new Set(after.map((id) => co(id)?.vertical).filter(Boolean));
      const target = new Set(circle.members.map((id) => co(id)?.vertical).filter(Boolean)).size;
      if (verticals.size !== target) problems.push(`The circle would cover ${verticals.size} of five verticals; the rule is ${numberWord(target).toLowerCase()}`);
    }
    return problems;
  };

  const candidates = s.companies
    .filter((c) => isActiveNamed(c) && !circle.members.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      vertical: c.vertical,
      stage: c.stage,
      intrinsic: validate(c.id, null),
      byOut: Object.fromEntries(circle.members.map((m) => [m, validate(c.id, m)])) as Record<string, string[]>,
    }));

  return {
    circleId: circle.id,
    name: circle.name,
    theme: circle.theme,
    session: `Session ${circle.session_n} of ${circle.of_n} · ${circle.next_label}`,
    rule: circle.composition_rule,
    members,
    excluded: circle.exclusions.map((e) => ({ id: e.company_id, name: nm(e.company_id), reason: e.reason })),
    invitesSent: s.extras.circleInvitesSent.includes(circle.id),
    candidates,
    commitments: s.circle_commitments
      .filter((c) => c.circle_id === circle.id)
      .map((c) => ({ id: c.id, company: nm(c.company_id), text: c.text, status: c.status })),
  };
}

// ── Growth Readiness ───────────────────────────────────────────────────
export function getReadiness(s: State) {
  return [...s.readiness_modules]
    .sort((a, b) => a.n - b.n)
    .map((m) => ({ id: m.id, n: String(m.n).padStart(2, "0"), name: m.name, outcome: m.outcome, domain: domainLabel(s, m.domain_id) }));
}
