"use client";
/** Eight diagnostic domain rows with scores, findings and evidence popovers (S5a, S5b). */
import { ScoreBar } from "@/components/ui";
import { Popover, Reveal } from "@/components/ui/client";
import { IconExternal } from "@/components/ui/icons";
import type { EvidenceItem, ScoredDomain } from "@/lib/ai/types";
import type { DomainOption } from "@/lib/data/projections/diagnostic";

export function hostOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function EvidencePopover({
  ev,
  sourceDates,
  label,
}: {
  ev: EvidenceItem;
  sourceDates?: Record<string, string>;
  label?: string;
}) {
  const loc = ev.location;
  const snapshot = loc ? sourceDates?.[loc.source_id] : undefined;
  return (
    <Popover
      label={`Evidence from ${ev.title}`}
      trigger={
        <span className="text-[12px] font-medium text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">
          {label ?? ev.title}
        </span>
      }
    >
      <span className="flex flex-col gap-2">
        <span className="text-[13px] text-ink">&ldquo;{ev.cited_text}&rdquo;</span>
        {ev.claim && <span className="text-ink-3">{ev.claim}</span>}
        {ev.url && (
          <a
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-lime hover:text-lime-bright"
          >
            {ev.url}
            <IconExternal size={11} />
          </a>
        )}
        {loc && (
          <span className="meta">
            {snapshot ? `Snapshot ${snapshot}, ` : "Snapshot, "}characters {loc.start}–{loc.end}
          </span>
        )}
      </span>
    </Popover>
  );
}

export function ScoreList({
  domains,
  scores,
  evidence,
  bindingDomain,
  sourceDates,
  showConfidence = true,
  streaming = false,
  emptyText,
}: {
  domains: DomainOption[];
  scores: ScoredDomain[];
  evidence: EvidenceItem[];
  bindingDomain?: string | null;
  sourceDates?: Record<string, string>;
  showConfidence?: boolean;
  /** while streaming, only scored domains render (they arrive one by one) */
  streaming?: boolean;
  emptyText?: string;
}) {
  const byDomain = new Map(scores.map((x) => [x.domain, x]));
  const evById = new Map(evidence.map((e) => [e.id, e]));
  const rows = streaming ? domains.filter((d) => byDomain.has(d.slug)) : domains;
  if (rows.length === 0 && emptyText) return <p className="text-[14px] text-ink-3">{emptyText}</p>;
  return (
    <ul className="flex flex-col" aria-live="polite">
      {rows.map((d) => {
        const sc = byDomain.get(d.slug);
        const binding = !!bindingDomain && bindingDomain === d.slug;
        const evs = (sc?.evidence_ids ?? []).map((id) => evById.get(id)).filter((e): e is EvidenceItem => !!e);
        return (
          <li key={d.slug} className="border-b border-line-2 py-4 last:border-b-0">
            <Reveal>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className={binding ? "text-[14px] font-semibold text-lime" : "text-[14px] font-semibold text-ink"}>
                  {d.label}
                  {binding && <span className="meta ml-2 font-medium text-ink-3">proposed binding</span>}
                </span>
                <span className="flex items-center gap-3">
                  {showConfidence && sc && <span className="meta">{sc.confidence} confidence</span>}
                  <ScoreBar score={sc?.score ?? null} binding={binding} label={d.label} />
                </span>
              </div>
              <p className="mt-1.5 text-[14px] text-ink-2">{sc ? sc.finding : "No evidence found for this domain."}</p>
              {evs.length > 0 && (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="meta">From</span>
                  {evs.map((ev) => (
                    <EvidencePopover key={ev.id} ev={ev} sourceDates={sourceDates} label={ev.url ? `${ev.title} · ${hostOf(ev.url)}` : ev.title} />
                  ))}
                </p>
              )}
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
