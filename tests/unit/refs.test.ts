import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSeedState } from "@/lib/data";
import { resolveRef } from "@/lib/data/projections/refs";
import { fold } from "@/lib/data/state";
import { getSeed } from "@/lib/data/seed";
import type { ShareholderDraft } from "@/lib/ai/types";

const s = getSeedState();
const file = path.join(process.cwd(), "data/precomputed/f6-q4.json");

describe("resolveRef", () => {
  it("reads portfolio statistics from the records", () => {
    const f = (field: string) => resolveRef(s, { type: "portfolio_stats", id: "portfolio", field })?.value;
    expect(f("backed")).toBe("13");
    expect(f("exits")).toBe("1");
    expect(f("firmRating")).toBe("4.4");
    expect(f("programsRunning")).toBe("12");
    expect(f("impactReporting")).toBe("7 of 11");
    expect(Number(f("lessonsSent"))).toBeGreaterThan(0);
  });

  it("reads company, lesson, path, fact and exit records", () => {
    expect(resolveRef(s, { type: "company", id: "desolenator", field: "round_closed_at" })?.value).toBe("15 Oct 2026");
    expect(resolveRef(s, { type: "company", id: "desolenator", field: "day" })?.value).toBe("39");
    expect(resolveRef(s, { type: "lesson", id: "wsense-strategic", field: "status" })?.value).toBe("proposed");
    expect(resolveRef(s, { type: "strategic_path", id: "wsense", field: "now" })?.value).toContain("Fincantieri");
    expect(resolveRef(s, { type: "fact", id: s.facts[0].id, field: "value" })?.value).toBe(s.facts[0].value);
    expect(resolveRef(s, { type: "exit", id: "wsense", field: "package" })?.value).toMatch(/€600m/);
    expect(resolveRef(s, { type: "exit", id: "wsense", field: "note" })?.value).toContain("Fincantieri");
    // spliced into prose, so no closing full stop (the Q4 update read "July 2026..")
    expect(resolveRef(s, { type: "exit", id: "wsense", field: "note" })?.value).not.toMatch(/\.$/);
  });

  it("returns null for unknown records and fields", () => {
    expect(resolveRef(s, { type: "company", id: "nope", field: "name" })).toBeNull();
    expect(resolveRef(s, { type: "portfolio_stats", id: "portfolio", field: "madeUp" })).toBeNull();
    expect(resolveRef(s, { type: "mystery", id: "x", field: "y" })).toBeNull();
  });

  it("follows session events", () => {
    const seed = getSeed();
    const st = fold(seed, [
      { id: "e1", firm_id: "rypples", session_id: "t", actor: "jerome", type: "lesson.approved", entity_type: "lesson", entity_id: "wsense-strategic", payload: { lesson_id: "wsense-strategic" }, at: "2026-11-23T10:00:00Z" },
    ]);
    expect(resolveRef(st, { type: "lesson", id: "wsense-strategic", field: "status" })?.value).toBe("approved");
  });
});

describe("f6-q4.json", () => {
  it.skipIf(!fs.existsSync(file))("every ref in the precomputed draft resolves", () => {
    const draft = JSON.parse(fs.readFileSync(file, "utf8")) as ShareholderDraft;
    const refs = draft.segments.flatMap((seg) => (seg.kind === "ref" ? [seg.ref] : []));
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(resolveRef(s, r), JSON.stringify(r)).not.toBeNull();
  });
});
