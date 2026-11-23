/**
 * Output guardrails (docs/07-ai.md F3, F5, F6 and §6).
 * - Numeric grounding: every number in a Captain answer must appear in this turn's tool results.
 * - F5: currency amounts and percentages absent from the context are removed.
 * - F6: text segments carry no digits except years and quarter labels.
 * - Tone checks used by evals and as a light runtime filter.
 */

/** Markers like ⟦ref:company/vessev⟧ */
export const REF_MARKER = /⟦ref:([a-z_]+)\/([^⟧\s]+)⟧/g;
export const stripRefMarkers = (s: string) => s.replace(/\s?⟦[^⟧]*⟧/g, "").replace(/[ \t]+([.,;:])/g, "$1");
export function parseRefMarkers(s: string): { type: string; id: string }[] {
  return [...s.matchAll(REF_MARKER)].map((m) => ({ type: m[1]!, id: m[2]! }));
}

/** A number token as written, e.g. "1,180", "4.40", "€600m", "97%", "US$1". */
const NUM = /(?:[€$£]|US\$)?\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?:[€$£]|US\$)?\s?\d+(?:\.\d+)?/g;

/** Canonical form: separators, currency, %, suffixes and trailing zeros removed. "1,180"→"1180", "4.40"→"4.4". */
export function normalizeNumber(raw: string): string {
  let s = raw.replace(/US\$|[€$£%\s]/g, "").replace(/,/g, "");
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  s = s.replace(/^0+(?=\d)/, "");
  return s;
}

export function extractNumbers(text: string): { raw: string; norm: string; index: number }[] {
  const out: { raw: string; norm: string; index: number }[] = [];
  for (const m of text.matchAll(NUM)) {
    const raw = m[0].trim();
    const idx = (m.index ?? 0) + (m[0].length - m[0].trimStart().length);
    // skip list markers ("1. ", "2) ") at the start of a line
    const before = text.slice(Math.max(0, idx - 1), idx);
    // labels such as Q4, P1, F7 or S5b are not figures
    if (/[A-Za-z]/.test(before) && !/^(?:US\$|[€$£])/.test(raw)) continue;
    const after = text.slice(idx + raw.length, idx + raw.length + 2);
    if ((idx === 0 || before === "\n") && /^[.)]\s/.test(after)) continue;
    out.push({ raw, norm: normalizeNumber(raw), index: idx });
  }
  return out;
}

/** Numbers in `answer` that do not appear in any of the tool results. */
export function untracedNumbers(answer: string, toolResults: string[]): string[] {
  const known = new Set<string>();
  for (const r of toolResults) for (const n of extractNumbers(r)) known.add(n.norm);
  const words: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
  for (const r of toolResults) for (const w of r.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g) ?? []) known.add(words[w]!);
  const out: string[] = [];
  for (const n of extractNumbers(stripRefMarkers(answer))) {
    if (!known.has(n.norm) && !out.includes(n.raw)) out.push(n.raw);
  }
  return out;
}

const MONEY_OR_PCT = /(?:US\$|[€$£])\s?\d[\d,.]*\s?(?:k|m|bn|million|billion)?\b|\d[\d,.]*\s?(?:%|percent\b|per cent\b)|\d[\d,.]*\s?(?:k|m|bn|million|billion)?\s?(?:euros?|dollars?|EUR|USD)\b/gi;

/** F5: remove currency amounts and percentages that are not present in the context. */
export function stripUngroundedFinancials(text: string, context: string): { text: string; removed: string[] } {
  const ctxNums = new Set(extractNumbers(context).map((n) => n.norm));
  const removed: string[] = [];
  const out = text.replace(MONEY_OR_PCT, (m) => {
    const n = extractNumbers(m)[0];
    if (n && ctxNums.has(n.norm) && context.toLowerCase().includes(m.toLowerCase().replace(/\s+/g, " ").trim())) return m;
    removed.push(m.trim());
    return "";
  });
  return { text: out.replace(/[ \t]{2,}/g, " ").replace(/ ([.,;:])/g, "$1"), removed };
}

export const hasFinancialFigure = (text: string) => new RegExp(MONEY_OR_PCT.source, "i").test(text);

/** F6: digits are allowed only inside years (1900–2099) and quarter labels (Q1–Q4). Returns offending tokens. */
export function textDigitViolations(text: string): string[] {
  const cleaned = text.replace(/\bQ[1-4]\b/g, "").replace(/\b(19|20)\d{2}\b/g, "");
  return cleaned.match(/\d+/g) ?? [];
}

// ── Tone ──────────────────────────────────────────────────────────────────
const PROMO = /\b(revolutionary|game[- ]chang\w*|world[- ]class|best[- ]in[- ]class|cutting[- ]edge|disrupt\w*|unparalleled|groundbreaking|amazing|incredible)\b/i;
const SPECULATION = /\b(revenue|valuation|burn( rate)?|runway|profitab\w*|insolven\w*|bankrupt\w*)\b/i;

export function toneIssues(text: string): string[] {
  const issues: string[] = [];
  if (text.includes("!")) issues.push("exclamation mark");
  const p = text.match(PROMO);
  if (p) issues.push(`promotional word: ${p[0]}`);
  return issues;
}

/** Mentions of financial-health topics (revenue, valuation, burn, runway) for the F2 speculation check. */
export function financialSpeculation(text: string): string[] {
  return [...text.matchAll(new RegExp(SPECULATION.source, "gi"))].map((m) => m[0]);
}

/** Rough first-person check for the CEO letter. */
export const isFirstPerson = (text: string) => /\b(I|we|our|us|my|me)\b/i.test(text);
export const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;
