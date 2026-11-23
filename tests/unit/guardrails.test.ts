import { describe, expect, it } from "vitest";
import {
  extractNumbers,
  financialSpeculation,
  isFirstPerson,
  normalizeNumber,
  parseRefMarkers,
  stripRefMarkers,
  stripUngroundedFinancials,
  textDigitViolations,
  toneIssues,
  untracedNumbers,
  wordCount,
} from "@/lib/ai/guardrails";

describe("numeric grounding check (docs/07 §F3)", () => {
  it("accepts formatted equivalents", () => {
    expect(untracedNumbers("Capacity is 1,180 of 1600 hours.", ['{"used":1180,"total":"1,600"}'])).toEqual([]);
    expect(untracedNumbers("The firm rating is 4.40.", ['{"rating":4.4}'])).toEqual([]);
    expect(untracedNumbers("Spend was $2.5m, 12% over.", ['{"spend":"$2.5m","over":"12%"}'])).toEqual([]);
  });
  it("flags numbers that are not in any tool result", () => {
    expect(untracedNumbers("Five companies, 7 stuck, 30 hours.", ['{"stuck":5,"hours":30}'])).toEqual(["7"]);
    expect(untracedNumbers("Rating 4.5", ['{"rating":4.4}'])).toEqual(["4.5"]);
  });
  it("accepts number words that appear in tool results", () => {
    expect(untracedNumbers("3 of the companies", ['"three of five companies"'])).toEqual([]);
  });
  it("ignores labels and list markers", () => {
    expect(extractNumbers("1. Ask about Q4 and F7\n2. Review S5b").map((n) => n.raw)).toEqual([]);
    expect(untracedNumbers("1. Check the Q4 pack", [])).toEqual([]);
  });
  it("ignores numbers inside ref markers", () => {
    expect(untracedNumbers("Desolenator ⟦ref:company/desolenator-2⟧ is behind.", [])).toEqual([]);
  });
  it("normalises currency, separators and trailing zeros", () => {
    expect(normalizeNumber("$1,180.00")).toBe("1180");
    expect(normalizeNumber("12%")).toBe("12");
    expect(normalizeNumber("0.50")).toBe("0.5");
  });
});

describe("ref markers", () => {
  it("parses and strips markers", () => {
    const t = "Vessev ⟦ref:company/vessev⟧ is over benchmark ⟦ref:benchmark/operations⟧.";
    expect(parseRefMarkers(t)).toEqual([
      { type: "company", id: "vessev" },
      { type: "benchmark", id: "operations" },
    ]);
    expect(stripRefMarkers(t)).toBe("Vessev is over benchmark.");
  });
});

describe("F5 financial guardrail", () => {
  it("keeps figures present in the context and removes the rest", () => {
    const ctx = "Plant one costs €4.2m. Utilisation 92%.";
    const r = stripUngroundedFinancials("We need €4.2m and expect 15% returns at 92% utilisation.", ctx);
    expect(r.removed).toEqual(["15%"]);
    expect(r.text).toContain("€4.2m");
    expect(r.text).toContain("92%");
    expect(r.text).not.toContain("15%");
  });
});

describe("F6 digits rule", () => {
  it("allows years and quarter labels only", () => {
    expect(textDigitViolations("In Q4 2026 the portfolio grew.")).toEqual([]);
    expect(textDigitViolations("Thirteen companies, 5 stuck.")).toEqual(["5"]);
  });
});

describe("tone and text checks", () => {
  it("flags exclamation marks and promotional words", () => {
    expect(toneIssues("A revolutionary platform!")).toEqual(["exclamation mark", "promotional word: revolutionary"]);
    expect(toneIssues("Two pilots converted this quarter.")).toEqual([]);
  });
  it("finds financial-health topics", () => {
    expect(financialSpeculation("Revenue is growing and runway is long.").map((x) => x.toLowerCase())).toEqual(["revenue", "runway"]);
  });
  it("detects first person and counts words", () => {
    expect(isFirstPerson("Introduce us to the funds.")).toBe(true);
    expect(isFirstPerson("The board met on Thursday.")).toBe(false);
    expect(wordCount("  one two\nthree ")).toBe(3);
  });
});
