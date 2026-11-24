import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainScore, DomainScoreJson, Synthesis, SynthesisJson, scoreIssues, synthesisIssues } from "@/lib/ai/schemas/diagnostic";
import { RelevanceCheckJson, insufficientReasons } from "@/lib/ai/schemas/any-company";
import { ShareholderJson, ShareholderOut, shareholderIssues } from "@/lib/ai/schemas/shareholder-update";
import { DayOnePlan, DayOnePlanJson, normalizePlan, planIssues } from "@/lib/ai/schemas/day-one";
import { JudgeJson, JudgeVerdict } from "@/lib/ai/schemas/judge";
import { CaptainInput } from "@/lib/ai/schemas/captain";
import { LessonMatchJson, LessonMatchOut, reasonCitesFact } from "@/lib/ai/schemas/lesson-match";
import { cleanStrings, lowerEnums, nullsToUndefined, toStrictJsonSchema } from "@/lib/ai/schemas/common";
import { precomputed } from "@/lib/ai/precomputed";

type J = { type?: string | string[]; properties?: Record<string, J>; required?: string[]; additionalProperties?: boolean; items?: J; anyOf?: J[]; oneOf?: J[] };

/** Every object in a strict schema lists all properties as required and forbids extras. */
function assertStrict(s: J, at = "$") {
  if (s.properties) {
    expect(s.additionalProperties, `${at} additionalProperties`).toBe(false);
    expect([...(s.required ?? [])].sort(), `${at} required`).toEqual(Object.keys(s.properties).sort());
    for (const [k, v] of Object.entries(s.properties)) assertStrict(v, `${at}.${k}`);
  }
  if (s.items) assertStrict(s.items, `${at}[]`);
  for (const x of [...(s.anyOf ?? []), ...(s.oneOf ?? [])]) assertStrict(x, at);
}

describe("zod ↔ JSON Schema", () => {
  it.each([
    ["DomainScore", DomainScoreJson],
    ["Synthesis", SynthesisJson],
    ["RelevanceCheck", RelevanceCheckJson],
    ["Shareholder", ShareholderJson],
    ["DayOnePlan", DayOnePlanJson],
    ["Judge", JudgeJson],
  ])("%s is strict (all required, no additional properties)", (_n, json) => {
    assertStrict(json as J);
  });

  it("round-trips: values valid for zod are shaped like the JSON Schema", () => {
    const score = { domain: "financing", score: 2, confidence: "medium", finding: "Thin.", evidence_ids: ["e1"] };
    expect(DomainScore.parse(score)).toEqual(score);
    const props = (DomainScoreJson as J).properties!;
    expect(Object.keys(props).sort()).toEqual(Object.keys(score).sort());
    const back = z.fromJSONSchema ? z.fromJSONSchema(DomainScoreJson as never) : null;
    if (back) expect(back.safeParse(score).success).toBe(true);
  });

  it("validates the precomputed F1, F4 and F7 content against the schemas", () => {
    for (const s of precomputed.f1.result.scores) expect(DomainScore.safeParse(s).success).toBe(true);
    expect(Synthesis.safeParse(precomputed.f1.result.synthesis).success).toBe(true);
    expect(LessonMatchOut.safeParse({ matches: precomputed.f4.result.matches, excluded: precomputed.f4.result.excluded }).success).toBe(true);
    expect(DayOnePlan.safeParse(precomputed.f7.plan).success).toBe(true);
  });

  it("makes optional fields nullable-tolerant and normalises input", () => {
    expect(nullsToUndefined({ a: null, b: { c: null, d: 1 } })).toEqual({ b: { d: 1 } });
    expect(lowerEnums({ domain: "Financing", list: [{ confidence: "HIGH" }] }, ["domain", "confidence"])).toEqual({ domain: "financing", list: [{ confidence: "high" }] });
    expect(cleanStrings({ m: "a\u0000b​ c" })).toEqual({ m: expect.not.stringContaining("\u0000") });
    expect(toStrictJsonSchema(z.object({ x: z.string().optional() }))).toMatchObject({ required: ["x"], additionalProperties: false });
  });
});

describe("validators", () => {
  const ids = new Set(["e1", "e2"]);
  it("reject unknown evidence ids", () => {
    expect(scoreIssues({ domain: "financing", score: 2, confidence: "low", finding: "", evidence_ids: ["e9"] }, ids, "financing")).toContain("unknown evidence id e9");
  });
  it("reject a non-null score without evidence", () => {
    expect(scoreIssues({ domain: "financing", score: 2, confidence: "low", finding: "", evidence_ids: [] }, ids, "financing")).toContain("score without evidence");
    expect(scoreIssues({ domain: "ai", score: null, confidence: "low", finding: "", evidence_ids: [] }, ids, "ai")).toEqual([]);
  });
  it("reject the wrong domain", () => {
    expect(scoreIssues({ domain: "people", score: null, confidence: "low", finding: "", evidence_ids: [] }, ids, "ai")).toContain("domain should be ai");
  });
  it("reject unknown programs or lessons in a synthesis, and an unexplained high binding score", () => {
    const syn = { binding_domain: "financing" as const, binding_statement: "x", rationale: "Because.", evidence_ids: ["e1"], questions: ["a", "b", "c"], program_ids: ["nope"], lesson_ids: ["gone"] };
    const issues = synthesisIssues(syn, { evidenceIds: ids, programIds: new Set(["finance-sprint"]), lessonIds: new Set(), scores: new Map([["financing", 4]]) });
    expect(issues).toEqual(["unknown program nope", "unknown lesson gone", "binding domain scores above 3 without an explicit explanation"]);
  });
  it("reject figures in F6 text segments and unresolved refs", () => {
    const d = ShareholderOut.parse({
      title: "Q4 2026",
      segments: [
        { kind: "text", text: "In Q4 2026 we backed 13 companies." },
        { kind: "ref", ref: { type: "portfolio", id: "stats", field: "backed" } },
        { kind: "ref", ref: { type: "company", id: "ghost", field: "name" } },
      ],
      held_back: [],
    });
    const issues = shareholderIssues(d, (r) => r.id !== "ghost");
    expect(issues).toEqual(["segment 0 has figures in text: 13", "segment 2 ref does not resolve: company/ghost/name"]);
  });
  it("apply the F2 insufficient rule", () => {
    expect(insufficientReasons({ evidenceCount: 8, sourceDomains: 4, bindingEvidence: 2 })).toEqual([]);
    expect(insufficientReasons({ evidenceCount: 5, sourceDomains: 2, bindingEvidence: 1 })).toHaveLength(3);
  });
  it("check the F7 plan: binding domain and three ranked priorities", () => {
    const plan = DayOnePlan.parse(normalizePlan(structuredClone(precomputed.f7.plan)));
    expect(planIssues(plan, "operations")).toEqual([]);
    expect(planIssues(plan, "financing").length).toBeGreaterThan(0);
  });
  it("check F4 reasons cite a fact", () => {
    expect(reasonCitesFact("Its Rotterdam pilot mirrors the lesson.", ["Pilot: Rotterdam port"])).toBe(true);
    expect(reasonCitesFact("Good fit.", ["Pilot: Rotterdam port"])).toBe(false);
  });
  it("bound Captain input and the judge verdict", () => {
    expect(CaptainInput.safeParse({ message: "x".repeat(1001), scope: { kind: "os" } }).success).toBe(false);
    expect(CaptainInput.safeParse({ message: "Hi", scope: { kind: "bridge" } }).success).toBe(false);
    expect(JudgeVerdict.parse({ pass: true, issues: [], notes: "" })).toEqual({ pass: true, issues: [], notes: "" });
  });
});

describe("structured output schemas use only keywords the API accepts", () => {
  it("contain no oneOf (the API rejects it; discriminated unions become anyOf)", () => {
    for (const s of [DomainScoreJson, SynthesisJson, JudgeJson, LessonMatchJson, ShareholderJson, DayOnePlanJson, RelevanceCheckJson]) {
      expect(JSON.stringify(s)).not.toContain('"oneOf"');
    }
    expect(JSON.stringify(ShareholderJson)).toContain('"anyOf"');
  });
});
