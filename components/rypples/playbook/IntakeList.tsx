"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { act } from "@/lib/actions";
import { Button, Meta, StatusDot, Tile } from "@/components/ui";
import { Sheet } from "@/components/ui/client";
import type { IntakeRow } from "@/lib/data/projections/playbook";

export function IntakeList({ rows }: { rows: IntakeRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = rows.find((r) => r.id === openId) ?? null;

  const review = (row: IntakeRow, outcome: "approved" | "rejected") => {
    setError(null);
    start(async () => {
      const res = await act("intake.reviewed", { intake_id: row.id, outcome }, { actor: "jerome", entityType: "intake_session", entityId: row.id });
      if (!res.ok) return setError(res.error);
      setOpenId(null);
      router.refresh();
    });
  };

  return (
    <>
      <Tile className="py-2">
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="grid gap-3 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-ink">{r.title}</span>
                <span className="meta">
                  {r.who} · {r.when}
                </span>
                <span className="text-[13px] text-ink-2">{r.outcome}</span>
              </div>
              <div className="flex items-center gap-4">
                {r.reviewed ? (
                  <StatusDot tone={r.reviewed === "approved" ? "lime" : "neutral"} label={r.reviewed === "approved" ? "Lesson approved" : "Lesson rejected"} />
                ) : null}
                <Button variant="outline" onClick={() => setOpenId(r.id)} aria-haspopup="dialog">
                  {r.reviewed ? "Open" : r.cta}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Tile>

      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.proposed ? "Proposed lesson" : "Actions added to missions"}
        meta={open ? `${open.title} · ${open.who} · ${open.when}` : undefined}
        footer={
          open?.proposed && !open.reviewed ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={pending} onClick={() => review(open, "approved")}>
                Approve
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => review(open, "rejected")}>
                Reject
              </Button>
              {error && <span role="alert" className="text-[13px] text-amber">{error}</span>}
            </div>
          ) : undefined
        }
      >
        {open && (
          <div className="flex flex-col gap-6">
            {open.proposed && (
              <div className="flex flex-col gap-3">
                <Meta>Proposed · drafted by Captain</Meta>
                <h3 className="font-display text-[20px] font-medium tracking-[-0.02em] text-ink">{open.proposed.title}</h3>
                <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2 text-[13px]">
                  <dt className="meta">Domain</dt>
                  <dd className="text-ink-2">{open.proposed.domain}</dd>
                  <dt className="meta">Came from</dt>
                  <dd className="text-ink-2">
                    {open.title}, {open.when}
                  </dd>
                </dl>
                {open.confidential && <p className="text-[13px] text-ink-2">From themes only. Circle notes stay confidential.</p>}
                {open.reviewed && (
                  <StatusDot tone={open.reviewed === "approved" ? "lime" : "neutral"} label={open.reviewed === "approved" ? "Approved by you" : "Rejected by you"} />
                )}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <h3 className="h2">Actions added to missions</h3>
              {open.actions.length === 0 ? (
                <p className="text-[14px] text-ink-3">No actions were added from this session.</p>
              ) : (
                <ol className="flex flex-col gap-2 text-[14px] text-ink-2">
                  {open.actions.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="meta w-4 shrink-0">{i + 1}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
