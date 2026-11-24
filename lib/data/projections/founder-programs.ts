/**
 * Founder programs (Rypples OS): Growth Readiness for companies and Ocean Scalers for CEOs.
 * Growth Readiness has no cohorts: each company's diagnostic recommends the modules it needs.
 */
import type { State } from "../state";
import { isActiveNamed, openConstraint } from "@/lib/domain/portfolio-stats";
import { numberWord } from "@/lib/scenario";

export const PROGRAM_TABS = [
  { key: "readiness", label: "Growth Readiness" },
  { key: "scalers", label: "Ocean Scalers" },
] as const;
export type ProgramTab = (typeof PROGRAM_TABS)[number]["key"];

const domainLabel = (s: State, d: string) => s.domains.find((x) => x.slug === d)?.label ?? d;

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

// ── CEO development ────────────────────────────────────────────────────
export function getCeoDevelopment(s: State) {
  return s.ceo_development.map((d) => {
    const c = s.companies.find((x) => x.id === d.company_id);
    const p = c ? s.people.find((x) => x.id === c.ceo_person_id) : null;
    return { id: d.id, who: p?.name ?? c?.name ?? "", company: c?.name ?? d.company_id, note: d.note };
  });
}

// ── Growth Readiness ───────────────────────────────────────────────────
export type ReadinessStatus = "not_needed" | "recommended" | "in_progress" | "done";
export const READINESS_LABEL: Record<ReadinessStatus, string> = {
  not_needed: "Not needed",
  recommended: "Recommended",
  in_progress: "In progress",
  done: "Done",
};

function modules(s: State) {
  return [...s.readiness_modules]
    .sort((a, b) => a.n - b.n)
    .map((m) => {
      const op = m.operator_id ? s.operators.find((o) => o.id === m.operator_id) : null;
      const program = m.program_id ? s.programs.find((p) => p.id === m.program_id) : null;
      return {
        id: m.id,
        n: String(m.n).padStart(2, "0"),
        name: m.name,
        focus: m.focus,
        outcome: m.outcome,
        domain: domainLabel(s, m.domain_id),
        expert: op?.role ?? null,
        expertId: op?.id ?? null,
        via: program?.name ?? null,
      };
    });
}

/** OS view: companies × modules. A company appears once its diagnostic recommends at least one module. */
export function getReadinessGrid(s: State) {
  const mods = modules(s);
  const ids = [...new Set(s.readiness_plans.map((r) => r.company_id))];
  const rows = ids
    .map((id) => s.companies.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => Number(b.anchor) - Number(a.anchor) || a.name.localeCompare(b.name))
    .map((c) => {
      const k = openConstraint(s, c.id);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        constraint: k ? domainLabel(s, k.domain_id) : null,
        cells: mods.map((m) => {
          const r = s.readiness_plans.find((x) => x.company_id === c.id && x.module_id === m.id);
          const status: ReadinessStatus = r ? r.status : "not_needed";
          return { moduleId: m.id, status, label: READINESS_LABEL[status], output: r?.output ?? null, note: r?.note ?? null };
        }),
      };
    });
  const count = (st: ReadinessStatus) => rows.reduce((a, r) => a + r.cells.filter((c) => c.status === st).length, 0);
  const modulesWithProgress = mods.map((m) => {
    const cells = rows.map((r) => r.cells.find((c) => c.moduleId === m.id)!);
    return {
      ...m,
      inProgress: cells.filter((c) => c.status === "in_progress").length,
      recommended: cells.filter((c) => c.status === "recommended").length,
      done: cells.filter((c) => c.status === "done").length,
    };
  });
  const waiting = rows.flatMap((r) =>
    r.cells
      .filter((c) => c.status === "recommended")
      .map((c) => {
        const m = mods.find((x) => x.id === c.moduleId)!;
        return { id: `${r.id}-${m.id}`, company: r.name, slug: r.slug, constraint: r.constraint, module: `${m.n} · ${m.name}`, expert: m.expert, via: m.via };
      }),
  );
  return {
    modules: modulesWithProgress,
    rows,
    waiting,
    counts: { companies: rows.length, recommended: count("recommended"), inProgress: count("in_progress"), done: count("done") },
  };
}

/** Founder view in Rypples Engine: this company's modules, and the rest available to request. */
export function getCompanyReadiness(s: State, companyId: string) {
  const mods = modules(s);
  return mods.map((m) => {
    const r = s.readiness_plans.find((x) => x.company_id === companyId && x.module_id === m.id);
    return { ...m, status: (r ? r.status : "not_needed") as ReadinessStatus, output: r?.output ?? null, note: r?.note ?? null };
  });
}
