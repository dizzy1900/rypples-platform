"use client";
import { useState } from "react";
import Link from "next/link";
import { Illustrative, Meta, Monogram, StatusDot, Table, Td, Th, Tile } from "@/components/ui";
import { Sheet } from "@/components/ui/client";
import type { getPrograms } from "@/lib/data/projections/engine";

type View = ReturnType<typeof getPrograms>;

export function ProgramsTab({ view }: { view: View }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = view.rows.find((r) => r.id === openId) ?? null;
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
      <Tile className="py-2">
        <Table>
          <thead>
            <tr>
              <Th>Program</Th>
              <Th>Domain</Th>
              <Th>Length</Th>
              <Th>Delivered by</Th>
              <Th>Running</Th>
              <Th>Done</Th>
              <Th>Rating</Th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((p) => (
              <tr key={p.id}>
                <Td>
                  <button type="button" onClick={() => setOpenId(p.id)} aria-haspopup="dialog" className="flex flex-col gap-1 text-left">
                    <span className="text-[14px] font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-lime">{p.name}</span>
                    <span className="text-[13px] text-ink-3">Outcome: {p.outcome}</span>
                  </button>
                </Td>
                <Td>{p.domain}</Td>
                <Td>
                  {p.weeks} weeks · {p.hours} h
                </Td>
                <Td>{p.deliveredBy}</Td>
                <Td>{p.running}</Td>
                <Td>{p.done}</Td>
                <Td>{p.rating == null ? <span className="text-ink-3">Not yet rated</span> : <Illustrative>{p.rating.toFixed(1)}</Illustrative>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Tile>

      <div className="flex flex-col gap-6">
        {view.allocationCopy && (
          <Tile className="flex flex-col gap-3">
            <h3 className="h2">The allocation, in every term sheet</h3>
            <p className="text-[14px] text-ink-2">{view.allocationCopy}</p>
          </Tile>
        )}
        <Tile className="flex flex-col gap-4">
          <h3 className="h2">Operator capacity</h3>
          <p className="font-display text-[24px] leading-[1.15] tracking-[-0.02em] text-ink" data-testid="capacity-line">
            <Illustrative>{view.capacity.line}</Illustrative>
          </p>
          <div className="h-[6px] w-full rounded-full bg-off" aria-hidden>
            <div className="h-full rounded-full bg-[rgb(255_255_255/0.5)]" style={{ width: `${Math.round(view.capacity.pct * 100)}%` }} />
          </div>
          {view.tightest && (
            <p className="text-[13px] text-ink-2">
              Tightest: {view.tightest.role}, {view.tightest.pct}% committed
              {view.tightest.note ? `. ${view.tightest.note}` : `, ${view.tightest.left} hours left this quarter.`}
            </p>
          )}
        </Tile>
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ""}
        meta={open ? `${open.domain} · ${open.weeks} weeks · ${open.hours} operator hours` : undefined}
      >
        {open && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <h3 className="h2">Outcome</h3>
              <p className="text-[14px] text-ink-2">{open.outcome}</p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="h2">Delivered by</h3>
              <div className="flex items-center gap-3">
                {open.operator ? <Monogram initials={open.operator.initials} size={32} /> : null}
                <span className="text-[14px] text-ink-2">{open.operator ? open.operator.role : open.deliveredBy}</span>
              </div>
              {!open.operator && <Meta>No operator is assigned yet.</Meta>}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="h2">Companies enrolled</h3>
              {open.enrolled.length === 0 ? (
                <p className="text-[14px] text-ink-3">No company is enrolled right now.</p>
              ) : (
                <ul>
                  {open.enrolled.map((e) => (
                    <li key={e.companyId} className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line-2 py-3 first:border-t-0">
                      <Link href={`/os/companies/${e.slug}`} className="text-[14px] font-medium text-ink hover:text-lime">
                        {e.label ?? e.name}
                      </Link>
                      <StatusDot tone={e.status === "done" ? "lime" : "neutral"} label={`${e.status === "running" ? "Running" : e.status === "requested" ? "Requested" : "Done"}${e.progress ? ` · ${e.progress}` : ""}`} />
                    </li>
                  ))}
                </ul>
              )}
              {open.proposed.length > 0 && <Meta>Proposed, not yet running: {open.proposed.join(", ")}.</Meta>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
