import type { Market } from "./schema";

export type WeightKey = "water" | "solar" | "presence";
export type Weights = Record<WeightKey, number>;

export const DEFAULT_WEIGHTS: Weights = { water: 50, solar: 30, presence: 20 };

export interface ScoreOptions {
  use2030?: boolean;
}

export interface RankedMarket {
  market: Market;
  rank: number;
  composite: number; // 0-1
  /** Contribution of each indicator to the composite (sums to composite). */
  components: Weights;
  /** Basin water-stress score actually used (0-5), after the 2030 swap if on. */
  water_score: number;
  water_label: string;
}

/**
 * Aqueduct 4.0 category labels (parenthetical ranges stripped) and the score used when a projected label has
 * to be mapped to a number for the "Use 2030 projection" toggle. Each category maps to the midpoint of its
 * 0-5 score band: Low 0.5, Low-medium 1.5, Medium-high 2.5, High 3.5, Extremely high 4.5. "Arid and low water
 * use" maps to 5, matching how Aqueduct itself scores those basins.
 */
export const LABEL_TO_SCORE: Record<string, number> = {
  "low": 0.5,
  "low-medium": 1.5,
  "medium-high": 2.5,
  "high": 3.5,
  "extremely high": 4.5,
  "arid and low water use": 5,
};

/** "Extremely High (>80%)" -> "extremely high"; "Low - Medium (10-20%)" -> "low-medium". */
function labelKey(label: string): string {
  return label.replace(/\(.*?\)/g, "").replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Label without its parenthetical range, e.g. "Extremely high (>80%)" -> "Extremely high". */
export function shortLabel(label: string): string {
  return label.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function labelToScore(label: string): number | null {
  const v = LABEL_TO_SCORE[labelKey(label)];
  return v === undefined ? null : v;
}

export function normaliseWeights(w: Weights): Weights {
  const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const water = clean(w.water);
  const solar = clean(w.solar);
  const presence = clean(w.presence);
  const total = water + solar + presence;
  if (total === 0) return { water: 100 / 3, solar: 100 / 3, presence: 100 / 3 };
  return {
    water: (water / total) * 100,
    solar: (solar / total) * 100,
    presence: (presence / total) * 100,
  };
}

/**
 * Set one slider to `value` (0-100); the other two share the remainder proportionally to their current values
 * (equally if both are zero). Result sums to 100.
 */
export function setWeight(weights: Weights, key: WeightKey, value: number): Weights {
  const v = Math.min(100, Math.max(0, value));
  const others = (["water", "solar", "presence"] as WeightKey[]).filter((k) => k !== key);
  const rest = 100 - v;
  const sum = weights[others[0]] + weights[others[1]];
  const out = { ...weights, [key]: v } as Weights;
  if (sum <= 0) {
    out[others[0]] = rest / 2;
    out[others[1]] = rest / 2;
  } else {
    out[others[0]] = (weights[others[0]] / sum) * rest;
    out[others[1]] = (weights[others[1]] / sum) * rest;
  }
  return out;
}

function effectiveWater(m: Market, use2030: boolean): { score: number; label: string } {
  const ws = m.water_stress;
  if (use2030 && ws.projected_2030_label) {
    const s = labelToScore(ws.projected_2030_label);
    if (s !== null) return { score: s, label: ws.projected_2030_label };
  }
  return { score: ws.basin_score, label: ws.basin_label };
}

export function scoreMarkets(
  markets: Market[],
  weights: Weights = DEFAULT_WEIGHTS,
  opts: ScoreOptions = { use2030: false },
): RankedMarket[] {
  const w = normaliseWeights(weights);
  const use2030 = !!opts.use2030;
  const solars = markets.map((m) => m.solar_kwh_m2_day);
  const min = Math.min(...solars);
  const max = Math.max(...solars);
  const span = max - min;

  const rows = markets.map((m) => {
    const ew = effectiveWater(m, use2030);
    const water = ew.score / 5;
    const solar = span > 0 ? (m.solar_kwh_m2_day - min) / span : 0;
    const present = m.presence.kind ? 1 : 0;
    const components: Weights = {
      water: (w.water / 100) * water,
      solar: (w.solar / 100) * solar,
      presence: (w.presence / 100) * present,
    };
    const composite = components.water + components.solar + components.presence;
    return { market: m, composite, components, water_score: ew.score, water_label: ew.label, rank: 0 };
  });

  const EPS = 1e-12;
  rows.sort((a, b) => {
    if (Math.abs(b.composite - a.composite) > EPS) return b.composite - a.composite;
    if (b.water_score !== a.water_score) return b.water_score - a.water_score;
    if (b.market.solar_kwh_m2_day !== a.market.solar_kwh_m2_day)
      return b.market.solar_kwh_m2_day - a.market.solar_kwh_m2_day;
    return a.market.iso3.localeCompare(b.market.iso3);
  });
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

function presenceSentence(m: Market): string {
  if (m.presence.kind === "pilot") return `Desolenator already runs pilots here (${m.presence.label}).`;
  if (m.presence.kind === "precedent") return `There is precedent here: ${m.presence.label}.`;
  return "Desolenator has no plant or pilot here yet.";
}

export function whyOne(r: RankedMarket): string {
  const m = r.market;
  const solar = m.solar_kwh_m2_day.toFixed(1);
  return `${m.country}: basin water stress ${shortLabel(r.water_label).toLowerCase()} (${r.water_score.toFixed(1)}/5) and ${solar} kWh/m²/day of sun. ${presenceSentence(m)}`;
}

export function whyTopThree(ranked: RankedMarket[]): string[] {
  return ranked.slice(0, 3).map(whyOne);
}
