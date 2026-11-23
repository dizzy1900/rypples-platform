import { describe, expect, it } from "vitest";
import { getSeedState } from "@/lib/data";
import { buildDayOne } from "@/lib/ai/flows/day-one";
import { DayOnePlan } from "@/lib/ai/schemas/day-one";
import { precomputed } from "@/lib/ai/precomputed";

describe("F7 deterministic outcomes for Tern (docs/11 §1 capacity, docs/07 F7)", () => {
  const s = getSeedState();
  const deal = s.deals.find((d) => d.id === "tern")!;
  const plan = DayOnePlan.parse(precomputed.f7.plan);
  const { result, steps, created } = buildDayOne(s, deal, plan, "test-session");

  it("binds on operations with three ranked priorities", () => {
    expect(result.binding.domain).toBe("operations");
    expect(result.priorities.map((p) => p.rank)).toEqual([1, 2, 3]);
  });
  it("starts Pilot to Contract and Key Hire within the 400-hour allocation", () => {
    expect(result.started.map((x) => x.program_id).sort()).toEqual(["key-hire", "pilot-to-contract"]);
    expect(result.hours_started).toBe(130);
    expect(result.hours_total).toBe(400);
    expect(steps.find(([k]) => k === "allocation")?.[1]).toBe("Pilot to Contract 70h + Key Hire 60h = 130/400");
  });
  it("defers the Finance Sprint because the Finance expert has 30 hours left", () => {
    expect(result.deferred).toHaveLength(1);
    expect(result.deferred[0]!.program_id).toBe("finance-sprint");
    expect(result.deferred[0]!.reason).toContain("The Finance expert has 30 hours left this quarter");
  });
  it("takes the last Maritime board partner seat (2 → 3 of 3)", () => {
    expect(result.partner).toMatchObject({ seats_used: 3, seats_total: 3 });
    expect(result.partner!.note).toBe("Recruit before the next Maritime deal");
  });
  it("attaches only the matching lesson", () => {
    expect(result.lessons.map((l) => l.id)).toEqual(["hire-ops-in-market"]);
  });
  it("creates a company, diagnostic and enrolments without touching the seed", () => {
    expect(created.company.slug).toBe(result.company_slug);
    expect(s.companies.some((c) => c.id === created.company.id)).toBe(false);
    expect(getSeedState().deals.find((d) => d.id === "tern")!.stage).toBe(deal.stage);
  });
});
