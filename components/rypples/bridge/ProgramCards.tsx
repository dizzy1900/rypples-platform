"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ProgramCardView } from "@/lib/data/projections/bridge";
import { act } from "@/lib/actions";

/** The eight programs. Request/accept records program.requested; capped by the allocation. */
export function ProgramCards({
  companyId,
  programs,
  used,
  total,
}: {
  companyId: string;
  programs: ProgramCardView[];
  used: number;
  total: number;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, ProgramCardView["status"]>>({});
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const status = (p: ProgramCardView) => local[p.id] ?? p.status;
  const localAdds = programs.filter((p) => local[p.id] === "requested" && p.status !== "requested").length;
  const usedNow = used + localAdds;
  const capped = usedNow >= total;

  const request = (p: ProgramCardView) => {
    setError(null);
    setLocal((m) => ({ ...m, [p.id]: "requested" }));
    start(async () => {
      const res = await act("program.requested", { company_id: companyId, program_id: p.id, via: "founder" }, { actor: `founder:${companyId}`, entityType: "program", entityId: p.id });
      if (!res.ok) {
        setLocal((m) => {
          const c = { ...m };
          delete c[p.id];
          return c;
        });
        setError("Could not send the request. Try again.");
      } else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {programs.map((p) => {
          const st = status(p);
          return (
            <li key={p.id} className="tile-outline flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <span className="meta uppercase tracking-[0.12em]">
                  {p.domainLabel} · {p.weeks} weeks
                </span>
                <span className="font-display text-[19px] font-medium leading-[1.2] tracking-[-0.01em] text-ink">{p.name}</span>
              </div>
              <p className="flex-1 text-[13px]">{p.outcome}</p>
              <div className="flex flex-col gap-2">
                {st === "running" && <Button disabled>Running</Button>}
                {st === "done" && <Button disabled>Completed</Button>}
                {st === "requested" && (
                  <Button variant="done" disabled aria-live="polite">
                    Requested
                  </Button>
                )}
                {st === "proposed" && (
                  <>
                    <span className="meta">Proposed by your board partner</span>
                    <Button onClick={() => request(p)} disabled={capped}>
                      {capped ? "Allocation used · ask your board partner" : "Accept"}
                    </Button>
                  </>
                )}
                {st === "none" && (
                  <Button onClick={() => request(p)} disabled={capped}>
                    {capped ? "Allocation used · ask your board partner" : "Request"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-[13px] text-amber">
          {error}
        </p>
      )}
    </div>
  );
}
