import { z } from "zod";
import { getMarkets, scoreMarkets, whyOne, DEFAULT_WEIGHTS } from "@/lib/geo";
import { allow, companyFor, defineTool, ref, stateFor, uniqRefs, type ToolResult } from "./types";

const SCOPES = ["rypples", "public", "founder"] as const;
/** Market evidence is built for Desolenator's plants (docs/09-geodata.md). */
const MARKET_COMPANIES = new Set(["desolenator"]);

export const getMarketEvidence = defineTool({
  name: "get_market_evidence",
  title: "Market evidence",
  description:
    "Ranked candidate markets for a company's next plants, from public datasets: basin water stress (WRI Aqueduct 4.0), solar resource (NASA POWER) and existing presence, with each market's indicator values and why it ranks where it does. Optional weights (water, solar, presence, 0-100). Available for Desolenator.",
  input: z.object({
    slug: z.string().min(1).max(100),
    weights: z.object({ water: z.number().min(0).max(100), solar: z.number().min(0).max(100), presence: z.number().min(0).max(100) }).optional(),
  }),
  scopes: [...SCOPES],
  readOnly: true,
  handler: async (ctx, input): Promise<ToolResult<Record<string, unknown>>> => {
    allow(ctx, [...SCOPES]);
    const s = await stateFor(ctx);
    const c = companyFor(ctx, s, input.slug);
    if (!MARKET_COMPANIES.has(c.id)) return { data: { company: c.name, markets: [], note: `No market evidence has been built for ${c.name} yet.` }, refs: [ref.company(c, ctx.viewer)] };
    const file = getMarkets();
    const weights = input.weights ?? DEFAULT_WEIGHTS;
    const ranked = scoreMarkets(file.markets, weights);
    const data = {
      company: c.name,
      weights,
      markets: ranked.slice(0, 10).map((r) => ({
        rank: r.rank,
        country: r.market.country,
        site: r.market.site.name,
        basin_water_stress: { score: r.water_score, label: r.water_label },
        solar_kwh_m2_day: r.market.solar_kwh_m2_day,
        presence: r.market.presence.label,
        composite: Math.round(r.composite * 100) / 100,
        why: whyOne(r),
      })),
      datasets: file.datasets.map((d) => ({ id: d.id, attribution: d.attribution, accessed_at: d.accessed_at, url: d.url })),
      provenance: "public datasets; weights are a planning choice",
    };
    const dsRefs = file.datasets.map((d) => ref.source(d.id, d.attribution, d.url));
    return { data, refs: uniqRefs([ref.markets(c.slug, c.name), ...dsRefs]) };
  },
});
