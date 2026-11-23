import type { State } from "../state";
import type { DomainSlug } from "@/lib/domain/schemas";
import { Vertical } from "@/lib/domain/schemas";
import { filteredCounts, openConstraint, portfolioCounts, portfolioRows } from "@/lib/domain/portfolio-stats";
import { sourceLabel } from "@/lib/domain/benchmarks";
import { numberWord, offsetLabel } from "@/lib/scenario";

export const VERTICALS = Vertical.options as readonly string[];
export type PortfolioView = "table" | "map";

export function parsePortfolioParams(sp: { vertical?: string | string[]; view?: string | string[] }) {
  const v = Array.isArray(sp.vertical) ? sp.vertical[0] : sp.vertical;
  const w = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  return {
    vertical: v && VERTICALS.includes(v) ? v : null,
    view: (w === "map" ? "map" : "table") as PortfolioView,
  };
}

export type PortfolioItem = {
  slug: string;
  name: string;
  tagline: string | null;
  vertical: string | null;
  region: string | null;
  stage: string | null;
  anchor: boolean;
  sessionAdded: boolean;
  matches: boolean;
  domain: DomainSlug | null;
  domainLabel: string | null;
  statement: string | null;
  provisional: boolean;
  constraintProvenance: "public" | "scenario" | "illustrative" | "generated";
  daysOpen: number | null;
  benchmarkDays: number | null;
  benchmarkLabel: string | null;
  overBenchmark: boolean;
  rating: number | null;
  nextBoard: string;
};

export function getPortfolio(s: State, vertical: string | null) {
  const counts = portfolioCounts(s);
  const stats = filteredCounts(s, vertical);
  const label = (d: DomainSlug) => s.domains.find((x) => x.slug === d)?.label ?? d;
  const items: PortfolioItem[] = portfolioRows(s).map((r) => {
    const c = r.company;
    const k = openConstraint(s, c.id);
    const next = s.board_meetings.find((b) => b.company_id === c.id && b.kind === "next");
    const nextBoard =
      next?.at_offset != null
        ? offsetLabel(next.at_offset)
        : c.next_board_offset != null
          ? offsetLabel(c.next_board_offset)
          : (next?.label ?? c.next_board_label ?? "");
    return {
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      vertical: c.vertical,
      region: c.region,
      stage: c.stage,
      anchor: c.anchor,
      sessionAdded: c.session_added,
      matches: !vertical || c.vertical === vertical,
      domain: r.constraintDomain,
      domainLabel: r.constraintDomain ? label(r.constraintDomain) : null,
      statement: r.constraintStatement,
      provisional: r.provisional,
      constraintProvenance: k?.provenance ?? "illustrative",
      daysOpen: r.daysOpen,
      benchmarkDays: r.benchmark?.days ?? null,
      benchmarkLabel: r.benchmark ? sourceLabel(r.benchmark.source_kind) : null,
      overBenchmark: r.overBenchmark,
      rating: r.rating,
      nextBoard,
    };
  });
  const exited = s.companies
    .filter((c) => c.status === "exited")
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      vertical: c.vertical,
      note: c.exit_note,
      matches: !vertical || c.vertical === vertical,
    }));
  const byDomain = s.domains
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((d) => ({ domain: d.slug, label: d.label, items: items.filter((i) => i.domain === d.slug) }));
  return {
    headline: `${numberWord(counts.backed)} backed. One constraint each.`,
    backed: counts.backed,
    stats,
    items,
    exited,
    byDomain,
    publicCount: counts.activePublic + counts.exits,
    unannounced: counts.unannounced,
  };
}
