"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Button, Prov, SourceChip } from "@/components/ui";
import { Popover } from "@/components/ui/client";
import { act } from "@/lib/actions";
import type { CapitalView } from "@/lib/data/projections/bridge";

/** Pilot to contract: four stages per buyer. Clicking a cell proposes a change, confirmed in a small popover. */
export function PilotTracker({ companyId, pilots, stages }: { companyId: string; pilots: CapitalView["pilots"]; stages: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, number>>(() => Object.fromEntries(pilots.map((p) => [p.id, p.stage])));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const confirm = (pilotId: string, stage: number) => {
    const prev = state[pilotId];
    setState((m) => ({ ...m, [pilotId]: stage }));
    setError(null);
    start(async () => {
      const res = await act("pilot.stage_confirmed", { pilot_id: pilotId, stage }, { actor: `founder:${companyId}`, entityType: "pilot", entityId: pilotId });
      if (!res.ok) {
        setState((m) => ({ ...m, [pilotId]: prev }));
        setError("Could not save that stage. Try again.");
      } else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul>
        {pilots.map((p) => {
          // stored stage: 0 = not yet piloting, 1 = Pilot … 4 = Multi-site; cell i is stage i + 1
          const cur = (state[p.id] ?? p.stage) - 1;
          return (
            <li key={p.id} className="flex flex-col gap-3 border-b border-line-2 py-4 last:border-b-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center lg:gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-[15px] font-medium text-ink">
                  <Prov p={p.provenance}>{p.name}</Prov>
                </span>
                {p.note && <span className="text-[13px] text-ink-3">{p.note}</span>}
                {p.source && (
                  <span>
                    <SourceChip href={p.source.url} label={p.source.label} />
                  </span>
                )}
              </div>
              <ol className="grid grid-cols-4 gap-2" aria-label={`${p.name} stages`}>
                {stages.map((st, i) => {
                  const reached = i <= cur;
                  const current = i === cur;
                  const cell = (
                    <span
                      className={clsx(
                        "flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-item border px-3 py-1.5 text-[12px] font-medium",
                        current ? "border-lime bg-lime-15 text-lime" : reached ? "border-lime-30 bg-lime-10 text-ink" : "border-line-2 bg-surface text-ink-2",
                      )}
                    >
                      <span>{st}</span>{" "}
                      <span className="text-[11px] font-normal">{current ? "Current" : reached ? "Reached" : "Not yet"}</span>
                    </span>
                  );
                  return (
                    <li key={st}>
                      {current ? (
                        <div aria-current="step">{cell}</div>
                      ) : (
                        <Popover label={`${st} ${reached ? "Reached" : "Not yet"}. Change ${p.name} to ${st}`} trigger={cell}>
                          <span className="flex flex-col gap-3">
                            <span className="text-[13px] text-ink">
                              Set {p.name} to <strong>{st}</strong>?
                            </span>
                            <span className="text-ink-3">Stages are yours to confirm. This is recorded and feeds your board pack.</span>
                            <span>
                              <Button onClick={() => confirm(p.id, i + 1)}>Confirm {st}</Button>
                            </span>
                          </span>
                        </Popover>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
      <p className="meta" aria-live="polite">
        {error ?? "Stages are yours to confirm."}
      </p>
    </div>
  );
}
