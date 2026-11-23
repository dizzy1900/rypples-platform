/**
 * The scenario clock (docs/01-product.md §4.1). Every "today", day count and
 * "this week" value derives from SCENARIO_DATE (a Monday, default 2026-11-23).
 */
import { addDays, differenceInCalendarDays, format } from "date-fns";

export const ROUND_CLOSE = "2026-10-15";
export const DEFAULT_SCENARIO_DATE = "2026-11-23";

/** Parse YYYY-MM-DD as a UTC-noon date (avoids DST edge cases). Throws unless it is a Monday. */
export function parseScenarioDate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`SCENARIO_DATE must be YYYY-MM-DD, got "${s}"`);
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`SCENARIO_DATE is not a date: "${s}"`);
  if (d.getUTCDay() !== 1) throw new Error(`SCENARIO_DATE must be a Monday, got ${s}`);
  return d;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const parseIso = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00Z`);

export function scenarioDateString(): string {
  return process.env.SCENARIO_DATE || DEFAULT_SCENARIO_DATE;
}

let cachedKey = "";
let cachedDate: Date | null = null;
export function scenarioDate(): Date {
  const s = scenarioDateString();
  if (s !== cachedKey || !cachedDate) {
    cachedDate = parseScenarioDate(s);
    cachedKey = s;
  }
  return cachedDate;
}

/** Day N of the first 100 since `from` (default: Desolenator round close). 15 Oct → 23 Nov = 39. */
export function dayInFirst100(from: string = ROUND_CLOSE, today: Date = scenarioDate()): number {
  return differenceInCalendarDays(today, parseIso(from));
}

export function daysSince(iso: string, today: Date = scenarioDate()): number {
  return differenceInCalendarDays(today, parseIso(iso));
}

/** Resolve a seeded day offset relative to the scenario date. */
export function offsetDate(offset: number, today: Date = scenarioDate()): Date {
  return addDays(today, offset);
}

/** "Thu 26 Nov" */
export const shortDay = (d: Date) => format(d, "EEE d MMM");
/** "Thursday 26 November" */
export const longDay = (d: Date) => format(d, "EEEE d MMMM");
/** "Monday 23 November" */
export const longDayNoYear = longDay;
/** "26 Nov" */
export const dayMonth = (d: Date) => format(d, "d MMM");
/** "15 Oct 2026" */
export const fullDate = (d: Date) => format(d, "d MMM yyyy");
/** "Thursday" */
export const weekday = (d: Date) => format(d, "EEEE");

export const offsetLabel = (offset: number) => shortDay(offsetDate(offset));

/**
 * Greeting from the scenario clock in Europe/Paris. The scenario date carries no time,
 * so the demo uses the real current time of day in Paris, applied to the scenario day.
 */
export function greeting(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now),
  );
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Number words for derived headings ("Thirteen backed."). */
const WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];
export const numberWord = (n: number) => WORDS[n] ?? String(n);
