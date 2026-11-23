"use client";
import { useState } from "react";
import Link from "next/link";
import { Illustrative, Meta, Monogram, Table, Td, Th, Tile } from "@/components/ui";
import { Sheet } from "@/components/ui/client";
import type { getPartners } from "@/lib/data/projections/engine";

type View = ReturnType<typeof getPartners>;

export function PartnersTab({ view }: { view: View }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = view.missions.find((m) => m.id === openId) ?? null;
  return (
    <div className="flex flex-col gap-8">
      <Tile className="py-2">
        <Table>
          <thead>
            <tr>
              <Th>Operator</Th>
              <Th>Focus</Th>
              <Th>Covers</Th>
              <Th>Open</Th>
              <Th>Delivered</Th>
              <Th>Rating</Th>
              <Th>Capacity</Th>
            </tr>
          </thead>
          <tbody>
            {view.roster.map((o) => (
              <tr key={o.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <Monogram initials={o.initials} size={32} />
                    <span className="text-[14px] font-medium text-ink">{o.role}</span>
                  </span>
                </Td>
                <Td>{o.focus}</Td>
                <Td>{o.covers.join(", ")}</Td>
                <Td>{o.open}</Td>
                <Td>{o.delivered}</Td>
                <Td>
                  <Illustrative>{o.rating.toFixed(1)}</Illustrative>
                </Td>
                <Td>
                  <div className="flex min-w-[150px] flex-col gap-1.5">
                    <div className="h-[6px] w-full rounded-full bg-off" aria-hidden>
                      <div className={`h-full rounded-full ${o.loadPct >= 90 ? "bg-amber" : "bg-[rgb(255_255_255/0.5)]"}`} style={{ width: `${Math.min(100, o.loadPct)}%` }} />
                    </div>
                    <span className="meta">
                      <Illustrative>{o.hours}</Illustrative> · {o.loadPct}%{o.seats ? ` · ${o.seats}` : ""}
                    </span>
                    {o.note && <span className="meta">{o.note}</span>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Tile>

      <section className="flex flex-col gap-4" aria-labelledby="due-h">
        <h2 id="due-h" className="h2">
          Due this week
        </h2>
        <Tile className="py-2">
          <ul>
            {view.missions.map((m) => (
              <li key={m.id} className="grid gap-2 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-medium text-ink">{m.title}</span>
                  <span className="meta">
                    {m.operator} · {m.company.name} · due {m.due}
                  </span>
                </div>
                <button type="button" className="text-link text-[13px]" onClick={() => setOpenId(m.id)} aria-haspopup="dialog">
                  Open brief
                </button>
              </li>
            ))}
          </ul>
        </Tile>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="rec-h">
        <h2 id="rec-h" className="h2">
          Recruiting and onboarding
        </h2>
        <Tile className="py-2">
          <ul>
            {view.recruiting.map((r) => (
              <li key={r.id} className="grid gap-1 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[1fr_160px] sm:gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-medium text-ink">{r.role}</span>
                  <span className="text-[13px] text-ink-2">
                    <Illustrative>{r.note}</Illustrative>
                  </span>
                </div>
                <span className="meta sm:text-right">{r.state}</span>
              </li>
            ))}
          </ul>
        </Tile>
        <Meta>{view.onboardingNote}</Meta>
      </section>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ""} meta={open ? `${open.operator} · due ${open.due}` : undefined}>
        {open && (
          <div className="flex flex-col gap-6">
            <Meta>Brief assembled from the records · {open.domain}</Meta>
            <div className="flex flex-col gap-1.5">
              <h3 className="h2">Context</h3>
              <p className="text-[14px] text-ink-2">
                {open.context}{" "}
                <Link href={`/os/companies/${open.company.slug}`} className="text-link">
                  Open {open.company.name}
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="h2">Constraint</h3>
              <p className="text-[14px] text-ink-2">{open.constraint ?? "No open constraint is recorded for this company."}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="h2">From the Playbook</h3>
              {open.lessons.length === 0 ? (
                <p className="text-[14px] text-ink-3">No approved Playbook entry covers this domain yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {open.lessons.map((l) => (
                    <li key={l.title} className="text-[14px] text-ink-2">
                      {l.title} <span className="meta">· learned in {l.learnedIn}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="h2">Three opening questions</h3>
              <ol className="flex flex-col gap-2">
                {open.questions.map((q, i) => (
                  <li key={i} className="grid grid-cols-[22px_1fr] text-[14px] text-ink-2">
                    <span className="font-display text-[16px] text-lime">{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
