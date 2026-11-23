"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath, type ExtendedFeature, type ExtendedFeatureCollection, type GeoGeometryObjects, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import topology from "@/data/geo/countries-110m.json";
import type { RankedMarket } from "@/lib/geo/score";
import { shortLabel } from "@/lib/geo/score";
import type { Pin } from "@/lib/geo/schema";

export interface MarketMapProps {
  ranked: RankedMarket[];
  pins: Pin[];
  compact?: boolean;
  highlightIso3?: string;
  onSelect?: (iso3: string) => void;
}

/** ISO 3166-1 numeric ids used by the world-atlas topojson, for the candidate markets. */
const ISO3_TO_NUMERIC: Record<string, string> = {
  ARE: "784", SAU: "682", OMN: "512", QAT: "634", KWT: "414", BHR: "048", JOR: "400", EGY: "818",
  MAR: "504", TUN: "788", ESP: "724", CYP: "196", GRC: "300", ITA: "380", CHL: "152", PER: "604",
  MEX: "484", NAM: "516", ZAF: "710", IND: "356", PAK: "586", AUS: "036", KHM: "116",
};

type CountryFeature = ExtendedFeature<GeoGeometryObjects | null, { name: string }> & { id?: string | number };

const countries: CountryFeature[] = (
  feature(
    topology as unknown as Topology,
    (topology as unknown as Topology).objects.countries as GeometryCollection,
  ) as unknown as ExtendedFeatureCollection<CountryFeature>
).features;

const countryById = new Map(countries.map((f) => [String(f.id).padStart(3, "0"), f]));

const W = 800;
const PAD = 0.06;
/** Lime opacity by composite quintile, best first: solid lime down to 15%. */
const RAMP = [1, 0.72, 0.5, 0.3, 0.15];

function quintile(index: number, n: number): number {
  return Math.min(4, Math.floor((index / n) * 5));
}

export function MarketMap({ ranked, pins, compact = false, highlightIso3, onSelect }: MarketMapProps) {
  const [world, setWorld] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const H = compact ? 220 : 440;
  const active = focus ?? hover;

  const { path, project, features } = useMemo(() => {
    const projection = geoNaturalEarth1();
    const mx = W * PAD;
    const my = H * PAD;
    const extent: [[number, number], [number, number]] = [
      [mx, my],
      [W - mx, H - my],
    ];
    if (world) {
      projection.fitExtent(extent, { type: "Sphere" } as GeoPermissibleObjects);
    } else {
      const candFeatures = ranked
        .map((r) => countryById.get(ISO3_TO_NUMERIC[r.market.iso3]))
        .filter((f): f is CountryFeature => !!f);
      const sites: GeoPermissibleObjects = {
        type: "MultiPoint",
        coordinates: ranked.map((r) => [r.market.site.lon, r.market.site.lat]),
      };
      projection.fitExtent(extent, {
        type: "GeometryCollection",
        geometries: [sites, ...candFeatures.map((f) => f.geometry).filter((g): g is GeoGeometryObjects => !!g)],
      } as GeoPermissibleObjects);
    }
    return {
      path: geoPath(projection),
      project: (lon: number, lat: number) => projection([lon, lat]) as [number, number],
      features: countries,
    };
  }, [ranked, world, H]);

  const byNumeric = useMemo(() => {
    const m = new Map<string, { r: RankedMarket; index: number }>();
    ranked.forEach((r, index) => m.set(ISO3_TO_NUMERIC[r.market.iso3], { r, index }));
    return m;
  }, [ranked]);

  const topN = compact ? 5 : ranked.length;

  function fillFor(index: number): { fill: string; opacity: number } {
    if (compact) {
      return index < 5
        ? { fill: "var(--color-lime)", opacity: RAMP[quintile(index, 5)] }
        : { fill: "var(--color-lime)", opacity: 0.06 };
    }
    return { fill: "var(--color-lime)", opacity: RAMP[quintile(index, ranked.length)] };
  }

  const activeRow = active ? ranked.find((r) => r.market.iso3 === active) : undefined;
  const summary = `Map of ${ranked.length} candidate markets for desalination, shaded by composite score. Top three: ${ranked
    .slice(0, 3)
    .map((r) => r.market.country)
    .join(", ")}.`;

  const tip = activeRow ? project(activeRow.market.site.lon, activeRow.market.site.lat) : null;

  return (
    <div className="relative w-full">
      {!compact && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setWorld((v) => !v)}
            aria-pressed={world}
            className="rounded-btn border border-line-2 bg-surface px-3 py-1 text-[12px] font-medium text-ink-2 hover:text-ink aria-pressed:border-lime-30 aria-pressed:text-lime"
          >
            World
          </button>
        </div>
      )}
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        style={compact ? { height: 220 } : { height: "auto", aspectRatio: `${W} / ${H}` }}
        preserveAspectRatio="xMidYMid meet"
      >
        <g aria-hidden="true">
          {features.map((f, fi) => {
            const id = f.id == null ? `x${fi}` : String(f.id).padStart(3, "0");
            const d = path(f);
            if (!d) return null;
            const hit = byNumeric.get(id);
            if (!hit) {
              return <path key={id} d={d} fill="#fff" fillOpacity={0.06} stroke="#fff" strokeOpacity={0.1} strokeWidth={0.5} />;
            }
            const { fill, opacity } = fillFor(hit.index);
            const iso = hit.r.market.iso3;
            const isHi = highlightIso3 === iso || active === iso;
            return (
              <path
                key={id}
                d={d}
                fill={fill}
                fillOpacity={opacity}
                stroke={isHi ? "var(--color-lime-bright)" : "#fff"}
                strokeOpacity={isHi ? 1 : 0.1}
                strokeWidth={isHi ? 1.5 : 0.5}
                style={{ cursor: onSelect ? "pointer" : "default" }}
                onMouseEnter={() => setHover(iso)}
                onMouseLeave={() => setHover((h) => (h === iso ? null : h))}
                onClick={() => onSelect?.(iso)}
              />
            );
          })}
          {/* Candidates without a 110m polygon (Bahrain) get a marker in the ramp colour */}
          {ranked.map((r, index) => {
            if (countryById.has(ISO3_TO_NUMERIC[r.market.iso3])) return null;
            const [x, y] = project(r.market.site.lon, r.market.site.lat);
            const { fill, opacity } = fillFor(index);
            return (
              <circle
                key={r.market.iso3}
                cx={x}
                cy={y}
                r={6}
                fill={fill}
                fillOpacity={opacity}
                stroke="#fff"
                strokeOpacity={0.3}
                onMouseEnter={() => setHover(r.market.iso3)}
                onMouseLeave={() => setHover((h) => (h === r.market.iso3 ? null : h))}
                onClick={() => onSelect?.(r.market.iso3)}
              />
            );
          })}
          {ranked.slice(0, topN).map((r) => {
            const [x, y] = project(r.market.site.lon, r.market.site.lat);
            return <circle key={r.market.iso3} cx={x} cy={y} r={compact ? 3 : 4} fill="#fff" fillOpacity={0.9} stroke="var(--color-ocean)" strokeWidth={1} pointerEvents="none" />;
          })}
          {pins.map((p) => {
            const [x, y] = project(p.lon, p.lat);
            return p.kind === "pilot" ? (
              <g key={p.name} pointerEvents="none">
                <circle cx={x} cy={y} r={4} fill="var(--color-ocean)" stroke="var(--color-lime)" strokeWidth={1} />
                <circle cx={x} cy={y} r={10} fill="none" stroke="var(--color-lime)" strokeWidth={1.5} />
              </g>
            ) : (
              <circle key={p.name} cx={x} cy={y} r={10} fill="none" stroke="var(--color-lime)" strokeWidth={1.5} strokeDasharray="3 3" pointerEvents="none" />
            );
          })}
        </g>
      </svg>

      {/* Keyboard access: one focusable control per candidate, in rank order */}
      <ul className="sr-only" aria-label="Candidate markets in rank order">
        {ranked.map((r) => (
          <li key={r.market.iso3}>
            <button
              type="button"
              onFocus={() => setFocus(r.market.iso3)}
              onBlur={() => setFocus((f) => (f === r.market.iso3 ? null : f))}
              onClick={() => onSelect?.(r.market.iso3)}
            >
              {`${r.rank}. ${r.market.country}, ${r.market.site.name}`}
            </button>
          </li>
        ))}
      </ul>

      {activeRow && tip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-[200px] rounded-item border border-line-2 bg-panel p-3 text-[12px] leading-snug text-ink-2"
          style={{
            left: `clamp(104px, ${(tip[0] / W) * 100}%, calc(100% - 104px))`,
            top: `${(tip[1] / H) * 100}%`,
            transform: tip[1] / H > 0.5 ? "translate(-50%, calc(-100% - 14px))" : "translate(-50%, 14px)",
          }}
        >
          <div className="font-semibold text-ink">
            {activeRow.market.country} <span className="font-normal text-ink-3">· {activeRow.market.site.name}</span>
          </div>
          <div>
            Basin water stress: {shortLabel(activeRow.water_label)} ({activeRow.water_score.toFixed(1)}/5)
          </div>
          <div>Solar: {activeRow.market.solar_kwh_m2_day.toFixed(1)} kWh/m²/day</div>
          <div>Presence: {activeRow.market.presence.label ?? "None"}</div>
        </div>
      )}
    </div>
  );
}

export default MarketMap;
