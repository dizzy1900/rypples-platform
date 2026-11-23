import { z } from "zod";
import { openConstraint, daysOpen } from "@/lib/domain/portfolio-stats";
import { effectiveBenchmark } from "@/lib/domain/benchmarks";
import { offsetLabel } from "@/lib/scenario";
import { allow, companyFor, defineTool, ref, stateFor, uniqRefs } from "./types";

const SCOPES = ["rypples", "public", "founder"] as const;
export const getCompany = defineTool({
  name: "get_company",
  title: "Company profile",
  description:
    "A portfolio company's profile: public facts with their sources (claims flagged as claims), the current binding constraint with days open and benchmark, lifecycle anchors and the next board meeting. Input is the company slug, e.g. 'desolenator'.",
  input: z.object({ slug: z.string().min(1).max(100) }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input) => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = companyFor(ctx, s, input.slug);
    const k = openConstraint(s, c.id);
    const b = k ? effectiveBenchmark(k.domain_id, s.benchmarks, s.cleared_cases) : null;
    const facts = s.facts.filter((f) => f.company_id === c.id);
    const srcs = s.sources.filter((x) => facts.some((f) => f.source_id === x.id));
    const next = s.board_meetings.find((m) => m.company_id === c.id && m.kind === "next");
    const data = {
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      vertical: c.vertical,
      region: c.region,
      stage: c.stage,
      status: c.status,
      website: c.website,
      anchor: c.anchor,
      board_seat: c.board_seat,
      round_closed_at: c.round_closed_at,
      provenance: c.provenance,
      facts: facts.map((f) => ({ label: f.label, value: f.value, is_claim: f.is_claim, source_url: s.sources.find((x) => x.id === f.source_id)?.url ?? null, provenance: f.provenance })),
      constraint: k
        ? {
            domain: k.domain_id,
            label: s.domains.find((d) => d.slug === k.domain_id)?.label ?? k.domain_id,
            statement: k.statement,
            provisional: k.provisional,
            days_open: daysOpen(k),
            benchmark: b ? { days: b.days, source_kind: b.source_kind, confidence: b.confidence } : null,
          }
        : null,
      lifecycle: s.lifecycle_stages.filter((l) => l.company_id === c.id).map((l) => ({ key: l.key, status: l.status, label: l.label, when: l.when })),
      next_board: next ? (next.at_offset != null ? offsetLabel(next.at_offset) : next.label) : c.next_board_label,
    };
    return { data, refs: uniqRefs([ref.company(c, ctx.viewer), ...srcs.map((x) => ref.source(x.id, x.title, x.url))]) };
  },
});
