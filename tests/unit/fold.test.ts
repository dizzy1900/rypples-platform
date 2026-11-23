import { describe, expect, it } from "vitest";
import { getSeed } from "@/lib/data/seed";
import { fold } from "@/lib/data/state";
import type { DemoEvent, EventPayload, EventType } from "@/lib/data/events";
import { companyRating, portfolioCounts } from "@/lib/domain/portfolio-stats";
import { allocationUsed } from "@/lib/domain/capacity";

const seed = getSeed();
let n = 0;
function ev<T extends EventType>(type: T, payload: EventPayload<T>, session = "s1"): DemoEvent {
  n++;
  return {
    id: `e${n}`,
    firm_id: "rypples",
    session_id: session,
    actor: "jerome",
    type,
    entity_type: "x",
    entity_id: "x",
    payload,
    at: new Date(Date.UTC(2026, 10, 23, 9, 0, n)).toISOString(),
  } as DemoEvent;
}

describe("fold: seed ∪ session events", () => {
  it("never mutates the seed", () => {
    const before = JSON.stringify(seed.decisions);
    fold(seed, [ev("decision.resolved", { decision_id: "dec-deso-firstloss", outcome: "board_agenda" })]);
    expect(JSON.stringify(seed.decisions)).toBe(before);
  });
  it("decision.resolved removes a decision from the open list", () => {
    const s = fold(seed, [ev("decision.resolved", { decision_id: "dec-deso-firstloss", outcome: "board_agenda" })]);
    expect(s.decisions.filter((d) => d.status === "open")).toHaveLength(2);
  });
  it("commitment.rated updates the company rating", () => {
    const s = fold(seed, [ev("commitment.rated", { commitment_id: "l2", rating: 3 })]);
    expect(companyRating(s, "desolenator")).toBe(3.5);
  });
  it("commitment.rated is ignored for undelivered commitments", () => {
    const s = fold(seed, [ev("commitment.rated", { commitment_id: "l1", rating: 1 })]);
    expect(s.commitments.find((c) => c.id === "l1")?.rating).toBeNull();
  });
  it("program.requested raises used to 3 and is capped at the total", () => {
    const s = fold(seed, [
      ev("program.requested", { company_id: "desolenator", program_id: "pilot-to-contract", via: "founder" }),
      ev("program.requested", { company_id: "desolenator", program_id: "certification", via: "founder" }),
    ]);
    expect(allocationUsed(s.enrolments, "desolenator").programs).toBe(3);
  });
  it("lesson.sent requires approval first", () => {
    const blocked = fold(seed, [ev("lesson.sent", { lesson_id: "wsense-strategic", company_id: "desolenator" })]);
    expect(blocked.extras.sentLessons).toHaveLength(0);
    const ok = fold(seed, [
      ev("lesson.approved", { lesson_id: "wsense-strategic" }),
      ev("lesson.sent", { lesson_id: "wsense-strategic", company_id: "desolenator" }),
    ]);
    expect(ok.extras.sentLessons.map((x) => x.company_id)).toEqual(["desolenator"]);
    expect(ok.lesson_matches.find((m) => m.company_id === "desolenator")?.status).toBe("sent");
  });
  it("instrument and pilot events toggle Bridge state", () => {
    const s = fold(seed, [
      ev("instrument.unshortlisted", { instrument_id: seed.instruments.find((i) => i.shortlisted)!.id }),
      ev("pilot.stage_confirmed", { pilot_id: seed.pilots[0].id, stage: 2 }),
    ]);
    expect(s.instruments.some((i) => i.shortlisted)).toBe(false);
    expect(s.pilots[0].stage).toBe(2);
  });
  it("board_pack.shared marks the pack shared", () => {
    const pack = seed.board_packs[0];
    const s = fold(seed, [ev("board_pack.shared", { pack_id: pack.id, company_id: pack.company_id })]);
    expect(s.board_packs[0].status).toBe("shared");
  });
  it("deal.moved changes stage; deal.created adds a sourced deal", () => {
    const s = fold(seed, [
      ev("deal.moved", { deal_id: "kelvin", from: "diligence", to: "ic" }),
      ev("deal.created", { deal: { ...seed.deals[0], id: "project-gybe", codename: "Project Gybe", stage: "sourced" } }),
    ]);
    expect(s.deals.find((d) => d.id === "kelvin")?.stage).toBe("ic");
    expect(s.deals.find((d) => d.id === "project-gybe")?.stage).toBe("sourced");
  });
  it("constraint.disputed + decision.created surface a decision for Jerome", () => {
    const s = fold(seed, [
      ev("constraint.disputed", { company_id: "desolenator", domain_id: "commercial", note: "Offtake is the limit" }),
      ev("decision.created", {
        decision_id: "dec-dispute-desolenator",
        company_id: "desolenator",
        context_label: "Desolenator",
        question: "Adri sees the constraint differently",
        line: "Commercial traction",
        action_label: "Review →",
        route: "/os/companies/desolenator",
      }),
    ]);
    expect(s.decisions.filter((d) => d.status === "open")).toHaveLength(4);
  });
  it("another session's events never leak", () => {
    const events = [ev("decision.resolved", { decision_id: "dec-deso-firstloss", outcome: "x" }, "other")];
    const mine = fold(seed, events.filter((e) => e.session_id === "s1"));
    expect(mine.decisions.filter((d) => d.status === "open")).toHaveLength(3);
    expect(portfolioCounts(mine).backed).toBe(13);
  });
});
