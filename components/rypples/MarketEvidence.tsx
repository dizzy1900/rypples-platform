"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MarketMap } from "./MarketMap";
import {
  DEFAULT_WEIGHTS,
  scoreMarkets,
  setWeight,
  shortLabel,
  whyTopThree,
  type RankedMarket,
  type WeightKey,
  type Weights,
} from "@/lib/geo/score";
import type { Dataset, Market, Pin } from "@/lib/geo/schema";
import { getMarkets } from "@/lib/geo";

export interface MarketEvidenceProps {
  markets: Market[];
  pins: Pin[];
  compact?: boolean;
  datasets?: Dataset[];
  onAskCaptain?: (prompt: string) => void;
}

const CAVEAT =
  "Shows where demand for desalinated water is physically strongest and solar resource is best. It does not show tariffs, market size or offtaker credit, which the Strategic Partner Map program covers.";

const SLIDERS: { key: WeightKey; label: string }[] = [
  { key: "water", label: "Water stress" },
  { key: "solar", label: "Solar resource" },
  { key: "presence", label: "Existing presence" },
];

function Illustrative({ m, children }: { m: Market; children: React.ReactNode }) {
  return m.water_stress.provenance === "illustrative" ? (
    <span className="ill" title="Illustrative figure">
      {children}
    </span>
  ) : (
    <>{children}</>
  );
}

function Row({ r, active, compact }: { r: RankedMarket; active: boolean; compact?: boolean }) {
  const m = r.market;
  return (
    <div
      className={`rounded-item border px-3 py-3 ${active ? "border-lime bg-lime-10" : "border-line-2 bg-surface"}`}
    >
      <div className="flex items-baseline gap-3">
        <span className="w-6 shrink-0 text-[12px] font-semibold text-ink-3 tabular-nums">{r.rank}</span>
        <span className="h2 flex-1">{m.country}</span>
        <span className="text-[13px] font-semibold text-ink tabular-nums" title={`Water ${r.components.water.toFixed(2)} + solar ${r.components.solar.toFixed(2)} + presence ${r.components.presence.toFixed(2)}`}>
          {Math.round(r.composite * 100)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`Composite score ${Math.round(r.composite * 100)} out of 100`}
      >
        <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(2, r.composite * 100)}%` }} />
      </div>
      {!compact && (
        <>
          <div className="mt-2 grid gap-x-4 gap-y-0.5 text-[12px] text-ink-2 sm:grid-cols-2">
            <span title={r.water_label}>
              <Illustrative m={m}>
                Water stress: {shortLabel(r.water_label)} ({r.water_score.toFixed(1)}/5)
              </Illustrative>
            </span>
            <span>Solar: {m.solar_kwh_m2_day.toFixed(1)} kWh/m²/day</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.presence.kind === "pilot" && (
              <span className="rounded-pill border border-lime-30 bg-lime-10 px-2 py-0.5 text-[11px] font-medium text-lime">Pilot here</span>
            )}
            {m.presence.kind === "precedent" && (
              <span className="rounded-pill border border-lime-30 px-2 py-0.5 text-[11px] font-medium text-lime">Grant precedent</span>
            )}
            {m.rypples_coverage && (
              <span className="rounded-pill border border-line-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">Rypples board partner coverage</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function MarketEvidence({ markets, pins, compact = false, datasets, onAskCaptain }: MarketEvidenceProps) {
  const reduce = useReducedMotion();
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [use2030, setUse2030] = useState(false);
  const [selected, setSelected] = useState<string | undefined>();
  const listRef = useRef<HTMLOListElement>(null);

  const ranked = useMemo(() => scoreMarkets(markets, weights, { use2030 }), [markets, weights, use2030]);
  const visible = useMemo(() => {
    const top = ranked.slice(0, compact ? 5 : 10);
    const sel = selected ? ranked.find((r) => r.market.iso3 === selected) : undefined;
    return sel && !top.includes(sel) ? [...top, sel] : top;
  }, [ranked, selected, compact]);
  const why = useMemo(() => whyTopThree(ranked), [ranked]);

  const ds = datasets ?? getMarkets().datasets;
  const accessed = ds.find((d) => d.id === "aqueduct40")?.accessed_at ?? "";
  const nearest = markets.filter((m) => m.water_stress.basin_match === "nearest").length;
  const fromCountry = markets.filter((m) => m.water_stress.basin_from_country).length;

  const onSelect = useCallback(
    (iso3: string) => {
      setSelected(iso3);
      requestAnimationFrame(() => {
        const el = document.getElementById(`market-row-${iso3}`);
        el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      });
    },
    [reduce],
  );

  const shown = SLIDERS.map(({ key }) => weights[key]).map(Math.round);
  shown[2] = 100 - shown[0] - shown[1];

  const prompt = `Which of these markets should Desolenator prioritise for its next plants, and why? Current ranking (weights: water stress ${shown[0]}, solar ${shown[1]}, presence ${shown[2]}${use2030 ? ", using the 2030 projection" : ""}): ${ranked
    .slice(0, 5)
    .map((r) => `${r.rank}. ${r.market.country}`)
    .join(", ")}.`;

  const attribution = (
    <p className="meta">
      Water stress:{" "}
      <a className="text-link underline underline-offset-2" href="https://www.wri.org/aqueduct" target="_blank" rel="noreferrer">
        WRI Aqueduct 4.0
      </a>{" "}
      (CC BY 4.0), accessed {accessed}. Solar:{" "}
      <a className="text-link underline underline-offset-2" href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">
        NASA POWER
      </a>{" "}
      climatology. Boundaries: Natural Earth.
      {nearest > 0 && ` For ${nearest} coastal sites with no basin polygon at the exact point, the nearest Aqueduct polygon (within 100 km) is used.`}
      {fromCountry > 0 && ` For ${fromCountry} markets the basin value is the country value.`}
    </p>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-4">
        <MarketMap ranked={ranked} pins={pins} compact highlightIso3={selected} onSelect={onSelect} />
        <ol className="flex flex-col gap-2" ref={listRef}>
          {visible.map((r) => (
            <li key={r.market.iso3} id={`market-row-${r.market.iso3}`}>
              <Row r={r} active={selected === r.market.iso3} compact />
            </li>
          ))}
        </ol>
        <p className="meta">{CAVEAT}</p>
        {attribution}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 min-[641px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="tile p-4">
          <MarketMap ranked={ranked} pins={pins} highlightIso3={selected} onSelect={onSelect} />
          <p className="meta mt-3">
            Shading is the composite score by quintile, darkest lime highest. Solid rings mark Desolenator pilots, the dashed ring marks the grant precedent.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <fieldset className="tile p-4">
            <legend className="sr-only">Ranking weights</legend>
            <div className="flex flex-col gap-3">
              {SLIDERS.map(({ key, label }, i) => (
                <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="text-[13px] font-medium text-ink">{label}</span>
                  <span className="text-[13px] font-semibold text-ink tabular-nums">{shown[i]}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[key]}
                    onChange={(e) => setWeights((w) => setWeight(w, key, Number(e.target.value)))}
                    className="col-span-2 w-full"
                    style={{ accentColor: "var(--color-lime)" }}
                  />
                </label>
              ))}
            </div>
            <p className="meta mt-2">Weights always sum to 100; moving one rebalances the others.</p>
            <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={use2030}
                onChange={(e) => setUse2030(e.target.checked)}
                style={{ accentColor: "var(--color-lime)" }}
              />
              Use 2030 projection
            </label>
          </fieldset>

          <ol className="flex flex-col gap-2" ref={listRef} aria-label="Ranked markets">
            {visible.map((r) => (
              <motion.li
                key={r.market.iso3}
                id={`market-row-${r.market.iso3}`}
                layout={reduce ? false : "position"}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Row r={r} active={selected === r.market.iso3} />
              </motion.li>
            ))}
          </ol>
        </div>
      </div>

      <section className="tile p-4" aria-labelledby="why-three">
        <h3 id="why-three" className="h2">
          Why these three
        </h3>
        <ol className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink-2">
          {why.map((t, i) => (
            <li key={i}>
              <span className="mr-2 text-ink-3 tabular-nums">{i + 1}.</span>
              {t}
            </li>
          ))}
        </ol>
        {onAskCaptain && (
          <button type="button" className="text-link mt-3 text-[13px]" onClick={() => onAskCaptain(prompt)}>
            Ask Captain about these markets
          </button>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink-2">{CAVEAT}</p>
        {attribution}
      </div>
    </div>
  );
}

export default MarketEvidence;
