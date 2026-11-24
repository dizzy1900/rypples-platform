/**
 * Loads and validates every seed file in data/seed/*.json against its zod schema.
 * JSON is imported statically so it bundles on Vercel. getSeed() is memoised.
 */
import { SeedFiles, type Seed, type SeedFileName } from "@/lib/domain/schemas";
import firms from "@/data/seed/firms.json";
import people from "@/data/seed/people.json";
import companies from "@/data/seed/companies.json";
import sources from "@/data/seed/sources.json";
import facts from "@/data/seed/facts.json";
import documents from "@/data/seed/documents.json";
import domains from "@/data/seed/domains.json";
import diagnostics from "@/data/seed/diagnostics.json";
import dimension_scores from "@/data/seed/dimension_scores.json";
import evidence from "@/data/seed/evidence.json";
import company_constraints from "@/data/seed/company_constraints.json";
import benchmarks from "@/data/seed/benchmarks.json";
import cleared_cases from "@/data/seed/cleared_cases.json";
import programs from "@/data/seed/programs.json";
import allocations from "@/data/seed/allocations.json";
import enrolments from "@/data/seed/enrolments.json";
import operators from "@/data/seed/operators.json";
import missions from "@/data/seed/missions.json";
import commitments from "@/data/seed/commitments.json";
import talent_roles from "@/data/seed/talent_roles.json";
import bench_groups from "@/data/seed/bench_groups.json";
import partner_types from "@/data/seed/partner_types.json";
import ceo_development from "@/data/seed/ceo_development.json";
import circles from "@/data/seed/circles.json";
import circle_commitments from "@/data/seed/circle_commitments.json";
import readiness_modules from "@/data/seed/readiness_modules.json";
import readiness_plans from "@/data/seed/readiness_plans.json";
import promises from "@/data/seed/promises.json";
import plans from "@/data/seed/plans.json";
import priorities from "@/data/seed/priorities.json";
import lifecycle_stages from "@/data/seed/lifecycle_stages.json";
import board_meetings from "@/data/seed/board_meetings.json";
import decisions from "@/data/seed/decisions.json";
import agenda_items from "@/data/seed/agenda_items.json";
import technical_risks from "@/data/seed/technical_risks.json";
import lessons from "@/data/seed/lessons.json";
import lesson_matches from "@/data/seed/lesson_matches.json";
import intake_sessions from "@/data/seed/intake_sessions.json";
import replay_steps from "@/data/seed/replay_steps.json";
import deals from "@/data/seed/deals.json";
import sourcing_signals from "@/data/seed/sourcing_signals.json";
import board_packs from "@/data/seed/board_packs.json";
import board_pack_sections from "@/data/seed/board_pack_sections.json";
import capital_layers from "@/data/seed/capital_layers.json";
import instruments from "@/data/seed/instruments.json";
import pilots from "@/data/seed/pilots.json";
import impact_kpis from "@/data/seed/impact_kpis.json";
import strategic_paths from "@/data/seed/strategic_paths.json";
import captain_overnight from "@/data/seed/captain_overnight.json";
import integrations from "@/data/seed/integrations.json";

const RAW: Record<SeedFileName, unknown> = {
  firms,
  people,
  companies,
  sources,
  facts,
  documents,
  domains,
  diagnostics,
  dimension_scores,
  evidence,
  company_constraints,
  benchmarks,
  cleared_cases,
  programs,
  allocations,
  enrolments,
  operators,
  missions,
  commitments,
  talent_roles,
  bench_groups,
  partner_types,
  ceo_development,
  circles,
  circle_commitments,
  readiness_modules,
  readiness_plans,
  promises,
  plans,
  priorities,
  lifecycle_stages,
  board_meetings,
  decisions,
  agenda_items,
  technical_risks,
  lessons,
  lesson_matches,
  intake_sessions,
  replay_steps,
  deals,
  sourcing_signals,
  board_packs,
  board_pack_sections,
  capital_layers,
  instruments,
  pilots,
  impact_kpis,
  strategic_paths,
  captain_overnight,
  integrations,
};

let cached: Seed | null = null;

export function getSeed(): Seed {
  if (cached) return cached;
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(SeedFiles) as SeedFileName[]) {
    const result = SeedFiles[name].safeParse(RAW[name]);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Seed file data/seed/${name}.json failed validation: ${issues}`);
    }
    out[name] = result.data;
  }
  cached = out as Seed;
  return cached;
}
