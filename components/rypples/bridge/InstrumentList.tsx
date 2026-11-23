"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Prov } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";
import { act } from "@/lib/actions";
import type { CapitalView } from "@/lib/data/projections/bridge";

/** Instruments with accessible Shortlist toggles (aria-pressed), optimistic, recorded as events. */
export function InstrumentList({ companyId, instruments }: { companyId: string; instruments: CapitalView["instruments"] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(() => Object.fromEntries(instruments.map((i) => [i.id, i.shortlisted])));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = (id: string) => {
    const next = !state[id];
    setState((m) => ({ ...m, [id]: next }));
    setError(null);
    start(async () => {
      const res = await act(next ? "instrument.shortlisted" : "instrument.unshortlisted", { instrument_id: id }, { actor: `founder:${companyId}`, entityType: "instrument", entityId: id });
      if (!res.ok) {
        setState((m) => ({ ...m, [id]: !next }));
        setError("Could not save. Try again.");
      } else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <ul>
        {instruments.map((i) => {
          const on = !!state[i.id];
          return (
            <li key={i.id} className="grid grid-cols-1 gap-3 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-ink">
                  <Prov p={i.provenance}>{i.name}</Prov>
                </span>
                <span className="text-[13px] text-ink-3">{i.why}</span>
              </div>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(i.id)}
                aria-label={`${on ? "Shortlisted" : "Shortlist"}: ${i.name}`}
                className={clsx(
                  "inline-flex items-center justify-center gap-2 rounded-btn border px-4 py-2 text-[13px] font-medium transition-colors",
                  on ? "border-lime-30 bg-lime-10 text-lime" : "border-lime-30 bg-surface text-ink hover:border-[rgb(172_207_9/0.65)]",
                )}
              >
                {on && <IconCheck size={14} />}
                {on ? "Shortlisted" : "Shortlist"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="meta" aria-live="polite">
        {error ?? "Candidates to verify"}
      </p>
    </div>
  );
}
