/**
 * Operating partners (Rypples OS): every partner at every funnel stage, in one CRM-style table.
 * Board-level partners are external, not Rypples staff; each works with one portfolio company's
 * board, where Rypples holds a seat. Experts and specialists work across the portfolio.
 */
import type { State } from "../state";
import type { DomainSlug, OnboardingStep, PartnerStage, Provenance } from "@/lib/domain/schemas";
import { firmCapacity, hoursLeft, inHoursPool, operatorLoad, tightestOperator } from "@/lib/domain/capacity";
import { effectiveBenchmark } from "@/lib/domain/benchmarks";
import { daysOpen, openConstraint } from "@/lib/domain/portfolio-stats";
import { offsetLabel } from "@/lib/scenario";

export const STAGES: { key: PartnerStage; label: string }[] = [
  { key: "sourcing", label: "Sourcing" },
  { key: "in_conversation", label: "In conversation" },
  { key: "onboarding", label: "Onboarding" },
  { key: "active", label: "Active" },
];

export const ONBOARDING_STEPS: { key: OnboardingStep; label: string }[] = [
  { key: "briefing", label: "Playbook briefing" },
  { key: "context_pack", label: "Context pack assembled by Captain" },
  { key: "first_engagement", label: "First mission or board agreed with the founder" },
  { key: "first_rating", label: "First founder rating" },
];

export const GROUP_LABEL = { board_level: "Board-level", expert: "Expert", specialist: "Specialist" } as const;
export type PartnerGroup = keyof typeof GROUP_LABEL;

const fmt = (n: number) => n.toLocaleString("en-GB");
const domainLabel = (s: State, d: string) => s.domains.find((x) => x.slug === d)?.label ?? d;

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
  partnerId: string;
  title: string;
  company: { name: string; slug: string };
  operator: string;
  due: string;
  context: string;
  constraint: string | null;
  goodLooksLike: string;
  whenYouDeliver: string;
  lessons: { title: string; learnedIn: string }[];
  domain: string;
  questions: string[];
};

function missionBriefs(s: State): MissionBrief[] {
  return s.missions
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
      // The program this mission sits in, when the same partner is running one for the company in this domain.
      const program = s.enrolments
        .filter((e) => e.company_id === m.company_id && e.operator_id === m.operator_id && e.status === "running")
        .map((e) => s.programs.find((p) => p.id === e.program_id))
        .find((p) => p && p.domain_id === domain);
      const founder = co ? s.people.find((p) => p.id === co.ceo_person_id)?.name?.split(" ")[0] : null;
      return {
        id: m.id,
        partnerId: m.operator_id,
        title: m.title,
        company: { name: co?.name ?? m.company_id, slug: co?.slug ?? m.company_id },
        operator: op ? op.role : "Unassigned",
        due: offsetLabel(m.due_offset),
        context: `${op?.role ?? "A partner"} is working with ${co?.name ?? m.company_id} on "${m.title}", due ${offsetLabel(m.due_offset)}.${pri ? ` It serves priority ${pri.rank}: ${pri.title}.` : ""}`,
        constraint: k
          ? `${domainLabel(s, k.domain_id)}: ${k.statement}${d != null && b ? ` Open ${d} days against a ${b.days}-day benchmark.` : ""}`
          : null,
        goodLooksLike: program
          ? `${program.outcome}. This is the ${program.name} outcome the founder signed up for.`
          : `${pri ? `Priority ${pri.rank} moves: ${pri.title.charAt(0).toLowerCase()}${pri.title.slice(1)}` : "The founder signs the output off as done"}.`,
        whenYouDeliver: `It goes to ${founder ?? "the founder"}'s ledger in Rypples Engine to be rated. Captain proposes a Playbook lesson from your notes, and once approved it is in Rypples OS for the next company.`,
        lessons: s.lessons.filter((l) => l.status === "approved" && l.domain_id === domain).map((l) => ({ title: l.title, learnedIn: l.learned_in })),
        domain: domainLabel(s, domain),
        questions: QUESTIONS[domain],
      };
    });
}

export function getOperatingPartners(s: State) {
  const co = (id: string) => s.companies.find((c) => c.id === id);
  const types = [...s.partner_types].sort((a, b) => a.sort - b.sort);
  const typeOf = (key: string) => types.find((t) => t.id === key);
  const briefs = missionBriefs(s);
  const benchTotal = s.bench_groups.reduce((a, g) => a + g.n, 0);

  const rows = s.operators.map((o) => {
    const t = typeOf(o.role_key);
    const group = (t?.group ?? "specialist") as PartnerGroup;
    const pooled = inHoursPool(o);
    const deal = o.for_deal_id ? s.deals.find((d) => d.id === o.for_deal_id) : null;
    const programs = s.programs
      .filter((p) => p.delivered_by_operator_id === o.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        outcome: p.outcome,
        running: s.enrolments
          .filter((e) => e.program_id === p.id && e.status === "running")
          .map((e) => co(e.company_id)?.name ?? e.company_id),
        done: p.done,
        rating: p.rating,
      }));
    const modules = s.readiness_modules
      .filter((m) => m.operator_id === o.id)
      .sort((a, b) => a.n - b.n)
      .map((m) => ({ n: String(m.n).padStart(2, "0"), name: m.name, via: m.program_id ? s.programs.find((p) => p.id === m.program_id)?.name ?? null : null }));
    const commitments = s.commitments
      .filter((c) => c.operator_id === o.id && c.status !== "delivered")
      .map((c) => ({ id: c.id, title: c.title, company: co(c.company_id)?.name ?? c.company_id, due: c.due_label }));
    return {
      id: o.id,
      initials: o.initials,
      name: o.role,
      typeId: o.role_key,
      typeLabel: t?.label ?? o.role,
      group,
      groupLabel: GROUP_LABEL[group],
      focus: o.focus,
      what: o.what ?? t?.what ?? "",
      stage: o.stage,
      stageLabel: STAGES.find((x) => x.key === o.stage)!.label,
      stageNote: o.stage_note,
      tools: o.tools,
      engagement: o.engagement,
      companies: o.covers.map((id) => ({ name: co(id)?.name ?? id, slug: co(id)?.slug ?? id, href: co(id) ? `/os/companies/${co(id)!.slug}` : null })),
      forDeal: deal && o.stage !== "active" ? { codename: deal.codename, href: `/os/pipeline?deal=${deal.id}` } : null,
      capacity: pooled
        ? { hours: `${o.hours_committed} of ${o.hours_quarter} h`, pct: Math.round(operatorLoad(o) * 100), left: hoursLeft(o), note: o.covers_note }
        : null,
      rating: o.rating,
      open: o.open_missions,
      delivered: o.delivered,
      onboarding: ONBOARDING_STEPS.map((st) => ({ ...st, done: o.onboarding_done.includes(st.key) })),
      onboardingDone: ONBOARDING_STEPS.filter((st) => o.onboarding_done.includes(st.key)).length,
      programs,
      modules,
      commitments,
      missions: briefs.filter((b) => b.partnerId === o.id).map((b) => ({ id: b.id, title: b.title, company: b.company.name, due: b.due })),
      talent:
        o.role_key === "people"
          ? {
              roles: s.talent_roles.map((r) => ({ id: r.id, role: r.role, company: co(r.company_id)?.name ?? r.company_id, slug: co(r.company_id)?.slug ?? r.company_id, why: r.why, state: r.state })),
              bench: s.bench_groups.map((g) => ({ id: g.id, label: g.label, n: g.n })),
              benchTotal,
            }
          : null,
      provenance: o.provenance as Provenance,
    };
  });

  const cap = firmCapacity(s.operators);
  const tight = tightestOperator(s.operators);
  const active = rows.filter((r) => r.stage === "active");
  return {
    rows,
    types: types.map((t) => ({ id: t.id, label: t.label, group: t.group as PartnerGroup, what: t.what })),
    groups: (Object.keys(GROUP_LABEL) as PartnerGroup[]).map((g) => ({ key: g, label: GROUP_LABEL[g] })),
    funnel: STAGES.map((st) => ({ ...st, partners: rows.filter((r) => r.stage === st.key).map((r) => ({ id: r.id, name: r.name, focus: r.focus, note: r.stageNote })) })),
    stats: {
      active: active.length,
      inFunnel: rows.length - active.length,
      boardLevel: active.filter((r) => r.group === "board_level").length,
      types: types.length,
    },
    capacity: { line: `${fmt(cap.committed)} of ${fmt(cap.total)} expert hours committed`, pct: Math.round(cap.pct * 100) },
    tightest: tight ? { role: tight.role, pct: Math.round(operatorLoad(tight) * 100), left: hoursLeft(tight), note: tight.covers_note } : null,
    briefs,
  };
}
export type OperatingPartnersView = ReturnType<typeof getOperatingPartners>;
