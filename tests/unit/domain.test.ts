import { describe, expect, it } from "vitest";
import { getSeed } from "@/lib/data/seed";
import { dayInFirst100, parseScenarioDate, offsetLabel, scenarioDate } from "@/lib/scenario";
import { portfolioCounts, stuckByConstraint, portfolioRows } from "@/lib/domain/portfolio-stats";
import { allocate, firmCapacity, tightestOperator, boardCandidateFor, boardPartnerFor, hoursLeft } from "@/lib/domain/capacity";
import { INTENTS, PROGRAM_FOR_INTENT } from "@/lib/domain/program-map";

const seed = getSeed();

describe("scenario clock", () => {
  it("is day 39 on 2026-11-23", () => {
    expect(dayInFirst100("2026-10-15", parseScenarioDate("2026-11-23"))).toBe(39);
  });
  it("rejects a non-Monday SCENARIO_DATE", () => {
    expect(() => parseScenarioDate("2026-11-24")).toThrow(/Monday/);
  });
  it("resolves relative offsets to the right weekday", () => {
    expect(scenarioDate().getUTCDay()).toBe(1);
    expect(offsetLabel(3)).toBe("Thu 26 Nov");
    expect(offsetLabel(4)).toBe("Fri 27 Nov");
    expect(offsetLabel(-4)).toBe("Thu 19 Nov");
  });
});

describe("portfolio stats (docs/05 §3 derived checks)", () => {
  it("counts stuck by constraint 5 / 4 / 2", () => {
    const stuck = Object.fromEntries(stuckByConstraint(seed).map((g) => [g.domain, g.count]));
    expect(stuck.operations).toBe(5);
    expect(stuck.commercial).toBe(4);
    expect(stuck.financing).toBe(2);
  });
  it("has every active company inside its benchmark (illustrative figures are kept positive)", () => {
    const rows = portfolioRows(seed);
    expect(rows.filter((r) => r.overBenchmark)).toEqual([]);
    expect(rows.filter((r) => r.daysOpen != null && r.benchmark != null)).toHaveLength(11);
  });
  it("keeps every illustrative founder rating at 4.2 or above", () => {
    const ratings = portfolioRows(seed).map((r) => r.rating).filter((r): r is number => r != null);
    expect(Math.min(...ratings)).toBeGreaterThanOrEqual(4.2);
  });
  it("backed 13, active 12 (incl. unannounced), active public 11, exit 1, unannounced 1, firm rating 4.4", () => {
    const c = portfolioCounts(seed);
    expect(c).toMatchObject({ backed: 13, active: 12, activePublic: 11, exits: 1, unannounced: 1, firmRating: 4.4, overBenchmark: 0 });
  });
  it("derives Desolenator days open from the round close (39)", () => {
    expect(portfolioRows(seed).find((r) => r.company.id === "desolenator")?.daysOpen).toBe(39);
  });
});

describe("capacity", () => {
  it("expert capacity is 844 of 1,120 hours and the finance expert is tightest", () => {
    expect(firmCapacity(seed.operators)).toMatchObject({ committed: 844, total: 1120 });
    expect(tightestOperator(seed.operators).id).toBe("fe");
    expect(hoursLeft(seed.operators.find((o) => o.id === "fe")!)).toBe(30);
  });
  it("F7 allocation: Key Hire and Pilot to Contract start, Finance Sprint deferred", () => {
    const { decisions, hoursStarted } = allocate(["finance-sprint", "pilot-to-contract", "key-hire"], seed.programs, seed.operators);
    const started = decisions.filter((d) => d.start).map((d) => d.program_id);
    expect(started.sort()).toEqual(["key-hire", "pilot-to-contract"]);
    expect(hoursStarted).toBe(130);
    const deferred = decisions.find((d) => !d.start);
    expect(deferred?.program_id).toBe("finance-sprint");
    expect(deferred && !deferred.start && deferred.reason).toMatch(/30 hours left/);
  });
  it("board-level partners look after one company each: Desolenator's is active, Tern's is a candidate", () => {
    expect(boardPartnerFor(seed.operators, "desolenator")?.id).toBe("bp-water");
    expect(boardPartnerFor(seed.operators, "hullbot")).toBeNull();
    expect(seed.operators.filter((o) => o.role_key === "board_partner").every((o) => o.covers.length <= 1)).toBe(true);
    expect(boardCandidateFor(seed.operators, "tern", "Maritime")?.id).toBe("bp-maritime");
  });
});

describe("program map", () => {
  it("maps every intent to exactly one existing program", () => {
    const programs = new Set(seed.programs.map((p) => p.id));
    for (const i of INTENTS) expect(programs.has(PROGRAM_FOR_INTENT[i])).toBe(true);
    expect(new Set(Object.values(PROGRAM_FOR_INTENT)).size).toBe(INTENTS.length);
  });
});
