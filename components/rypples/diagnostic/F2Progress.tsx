"use client";
/** Streamed progress for F2 (S5b): steps plus the live list of public sources. */
import { ProgressSteps, type StepState } from "@/components/ui/client";
import type { FlowSource, FlowStep } from "@/lib/ai/useFlow";
import { hostOf } from "./ScoreList";

export const F2_STEPS = [
  { key: "check", label: "Checking it's an ocean company" },
  { key: "search", label: "Searching public sources" },
  { key: "read", label: "Reading" },
  { key: "extract", label: "Extracting evidence" },
  { key: "score", label: "Scoring" },
  { key: "match", label: "Matching programs and lessons" },
];

export function F2Progress({
  steps,
  sources,
  evidenceCount,
  replaying,
}: {
  steps: FlowStep[];
  sources: FlowSource[];
  evidenceCount: number;
  replaying: boolean;
}) {
  const mapped = F2_STEPS.map((def) => {
    const st = steps.find((x) => x.key === def.key);
    const state: StepState = !st ? "waiting" : st.state === "done" ? "done" : "running";
    let detail = st?.detail;
    if (def.key === "search" && st && !detail) detail = `${sources.length} found`;
    if (def.key === "extract" && st && !detail) detail = `${evidenceCount} items`;
    return { key: def.key, label: def.label, state, detail };
  });
  const hosts = [...new Set(sources.map((x) => hostOf(x.url)).filter(Boolean))];
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {replaying && <p className="meta">Replaying a recent run</p>}
      <ProgressSteps steps={mapped} />
      {hosts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="meta">Sources found</span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
            {hosts.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
