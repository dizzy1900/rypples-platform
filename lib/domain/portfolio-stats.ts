/**
 * Derived portfolio numbers. Never hardcoded in JSX (docs/03-architecture.md §3).
 * Pure: takes seed-shaped collections (a folded State satisfies this).
 */
import type { Seed, Company, DomainSlug } from "./schemas";
import { effectiveBenchmark, type EffectiveBenchmark } from "./benchmarks";
import { daysSince, scenarioDate } from "@/lib/scenario";

type S = Pick<
  Seed,
  "companies" | "company_constraints" | "benchmarks" | "cleared_cases" | "commitments" | "domains"
>;

export const isBacked = (c: Company) => c.status === "active" || c.status === "exited" || c.status === "unannounced";
export const isActivePublic = (c: Company) => c.status === "active" && c.public;
/** Active companies that are named in the portfolio (public ones plus anchors added in the session). */
export const isActiveNamed = (c: Company) => c.status === "active" && (c.public || c.session_added === true);

export function openConstraint(s: Pick<Seed, "company_constraints">, companyId: string) {
  return s.company_constraints.find((k) => k.company_id === companyId && !k.cleared_at) ?? null;
}

export function daysOpen(k: { days_open: number | null; opened_at: string | null }, today = scenarioDate()) {
  if (k.days_open != null) return k.days_open;
  if (k.opened_at) return daysSince(k.opened_at, today);
  return null;
}

/** Mean of rated ledger rows, else the seeded aggregate. Null = pending. */
export function companyRating(s: Pick<Seed, "companies" | "commitments">, companyId: string): number | null {
  const rated = s.commitments.filter((c) => c.company_id === companyId && c.rating != null);
  if (rated.length) return round1(rated.reduce((a, c) => a + (c.rating ?? 0), 0) / rated.length);
  return s.companies.find((c) => c.id === companyId)?.rating_seed ?? null;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export type PortfolioRow = {
  company: Company;
  constraintDomain: DomainSlug | null;
  constraintStatement: string | null;
  provisional: boolean;
  daysOpen: number | null;
  benchmark: EffectiveBenchmark | null;
  overBenchmark: boolean;
  rating: number | null;
};

export function portfolioRows(s: S): PortfolioRow[] {
  return s.companies
    .filter((c) => isActiveNamed(c))
    .map((c) => {
      const k = openConstraint(s, c.id);
      const b = k ? effectiveBenchmark(k.domain_id, s.benchmarks, s.cleared_cases) : null;
      const d = k ? daysOpen(k) : null;
      return {
        company: c,
        constraintDomain: k?.domain_id ?? null,
        constraintStatement: k?.statement ?? null,
        provisional: k?.provisional ?? false,
        daysOpen: d,
        benchmark: b,
        overBenchmark: d != null && b != null && d > b.days,
        rating: companyRating(s, c.id),
      };
    });
}

export function stuckByConstraint(s: S, rows = portfolioRows(s)) {
  const groups = new Map<DomainSlug, PortfolioRow[]>();
  for (const r of rows) {
    if (!r.constraintDomain) continue;
    const g = groups.get(r.constraintDomain) ?? [];
    g.push(r);
    groups.set(r.constraintDomain, g);
  }
  return [...groups.entries()]
    .map(([domain, list]) => ({
      domain,
      label: s.domains.find((d) => d.slug === domain)?.label ?? domain,
      count: list.length,
      companies: list.map((r) => r.company),
      hasBoardSeat: list.some((r) => r.company.board_seat),
    }))
    .sort((a, b) => b.count - a.count);
}

export function portfolioCounts(s: S) {
  const backed = s.companies.filter(isBacked);
  const rows = portfolioRows(s);
  const numeric = rows.map((r) => r.rating).filter((r): r is number => r != null);
  return {
    backed: backed.length,
    activePublic: s.companies.filter(isActivePublic).length,
    active: s.companies.filter((c) => c.status === "active").length,
    unannounced: s.companies.filter((c) => c.status === "unannounced").length,
    exits: s.companies.filter((c) => c.status === "exited").length,
    overBenchmark: rows.filter((r) => r.overBenchmark).length,
    firmRating: numeric.length ? round1(numeric.reduce((a, b) => a + b, 0) / numeric.length) : null,
    ratedCompanies: numeric.length,
  };
}

/** Same counts for a vertical filter on S2 (rows dim, stats recalculate). */
export function filteredCounts(s: S, vertical: string | null) {
  const rows = portfolioRows(s).filter((r) => !vertical || r.company.vertical === vertical);
  const numeric = rows.map((r) => r.rating).filter((r): r is number => r != null);
  const exits = s.companies.filter((c) => c.status === "exited" && (!vertical || c.vertical === vertical)).length;
  return {
    active: rows.length,
    exits,
    overBenchmark: rows.filter((r) => r.overBenchmark).length,
    /** Companies with an open constraint that is inside its benchmark. */
    withinBenchmark: rows.filter((r) => r.daysOpen != null && r.benchmark != null && !r.overBenchmark).length,
    firmRating: numeric.length ? round1(numeric.reduce((a, b) => a + b, 0) / numeric.length) : null,
  };
}
