"use client";
/**
 * The learning curve (docs/02-design-system.md §7). Hand-built SVG with d3-scale and d3-shape, no chart library.
 * x = cleared case in clearance order, y = days to clear as a % of that domain's benchmark.
 * Points white 50%, rolling median (window 4) lime, dashed 100% line labelled "Benchmark".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import type { Benchmark, ClearedCase, DomainSlug } from "@/lib/domain/schemas";
import { learningCurve } from "@/lib/domain/benchmarks";

const H = 320;
const AXIS_FONT = 12;

export function LearningCurve({
  cases,
  benchmarks,
  domain,
  domainLabels,
}: {
  cases: ClearedCase[];
  benchmarks: Benchmark[];
  domain: DomainSlug | null;
  domainLabels: Record<string, string>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, median } = useMemo(() => learningCurve(cases, benchmarks, domain ?? undefined), [cases, benchmarks, domain]);
  const allMax = useMemo(() => Math.max(...learningCurve(cases, benchmarks).points.map((p) => p.pct), 100), [cases, benchmarks]);
  const maxSeq = Math.max(14, ...cases.map((c) => c.cleared_seq));

  const narrow = w < 520;
  const m = { l: narrow ? 40 : 48, r: narrow ? 64 : 92, t: 16, b: 44 };
  const x = scaleLinear().domain([1, maxSeq]).range([m.l, w - m.r]);
  const y = scaleLinear().domain([0, Math.ceil((allMax * 1.08) / 25) * 25]).range([H - m.b, m.t]);
  const yTicks = y.ticks(5);
  const xTicks = narrow ? [1, 5, 10, maxSeq] : Array.from({ length: maxSeq }, (_, i) => i + 1);
  const path = line<{ seq: number; pct: number }>()
    .x((d) => x(d.seq))
    .y((d) => y(d.pct))(median);
  const lastMedian = median[median.length - 1];
  const act = active != null ? points[active] : null;
  const label = domain ? domainLabels[domain] : "All domains";

  return (
    <figure className="flex flex-col gap-3" aria-label={`Learning curve, ${label}`}>
      <div ref={wrap} className="relative w-full">
        <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" aria-label={`Days to clear each case as a percentage of its domain benchmark, ${points.length} cases, ${label}.`} className="block max-w-full overflow-visible">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={AXIS_FONT} fill="var(--color-ink-3)">
                {t}%
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - m.b + 20} textAnchor="middle" fontSize={AXIS_FONT} fill="var(--color-ink-3)">
              {t}
            </text>
          ))}
          <text x={(m.l + w - m.r) / 2} y={H - 6} textAnchor="middle" fontSize={AXIS_FONT} fill="var(--color-ink-3)">
            Cleared case, in order
          </text>

          <line x1={m.l} x2={w - m.r} y1={y(100)} y2={y(100)} stroke="rgb(255 255 255 / 0.4)" strokeWidth={1} strokeDasharray="5 5" />
          <text x={w - m.r + 8} y={y(100)} dy="0.32em" fontSize={AXIS_FONT} fill="var(--color-ink-3)">
            Benchmark
          </text>

          {path && points.length > 1 && <path d={path} fill="none" stroke="var(--color-lime)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {lastMedian && points.length > 1 && (
            <text x={x(lastMedian.seq) + 10} y={y(lastMedian.pct)} dy="0.32em" fontSize={AXIS_FONT} fill="var(--color-lime)">
              {narrow ? "Median" : "Rolling median"}
            </text>
          )}

          {points.map((p, i) => (
            <circle
              key={p.seq}
              cx={x(p.seq)}
              cy={y(p.pct)}
              r={active === i ? 7 : 5}
              fill="rgb(255 255 255 / 0.5)"
              stroke={active === i ? "var(--color-ink)" : "none"}
              strokeWidth={1.5}
              tabIndex={0}
              role="img"
              aria-label={`${p.label}, ${domainLabels[p.domain_id]}: ${p.days} days, ${p.pct}% of benchmark`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((a) => (a === i ? null : a))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((a) => (a === i ? null : a))}
            />
          ))}
        </svg>
        {act && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-item border border-line-2 bg-panel px-3 py-2 text-[12px] leading-[1.5] text-ink-2"
            style={{
              left: Math.min(Math.max(8, x(act.seq) - 80), w - 228),
              top: Math.max(0, y(act.pct) - 76),
            }}
          >
            <span className="block font-medium text-ink">{act.label}</span>
            <span className="block">{domainLabels[act.domain_id]}</span>
            <span className="block">
              {act.days} days · {act.pct}% of benchmark
            </span>
          </div>
        )}
      </div>
      <figcaption className="text-[13px] text-ink-2">
        Each cleared constraint becomes a case. The median is falling: Rypples gets faster as the Playbook grows. <span className="ill">Illustrative.</span>
      </figcaption>
    </figure>
  );
}
