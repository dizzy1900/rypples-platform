"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Illustrative, Meta, Monogram, StatusDot, Table, Td, Th, Tile } from "@/components/ui";
import { SegmentedFilter, Sheet } from "@/components/ui/client";
import type { MissionBrief, OperatingPartnersView, PartnerGroup } from "@/lib/data/projections/partners";
import type { PartnerStage } from "@/lib/domain/schemas";

type Row = OperatingPartnersView["rows"][number];
type Open = { kind: "partner"; id: string } | { kind: "mission"; id: string } | null;

const stageTone = (st: PartnerStage) => (st === "active" ? "lime" : st === "onboarding" ? "amber" : "neutral");

export function PartnersCrm({ view, initialPartner }: { view: OperatingPartnersView; initialPartner: string | null }) {
  const [group, setGroup] = useState<PartnerGroup | null>(null);
  const [stage, setStage] = useState<PartnerStage | null>(null);
  const [open, setOpen] = useState<Open>(initialPartner && view.rows.some((r) => r.id === initialPartner) ? { kind: "partner", id: initialPartner } : null);

  const rows = useMemo(() => view.rows.filter((r) => (!group || r.group === group) && (!stage || r.stage === stage)), [view.rows, group, stage]);
  const partner = open?.kind === "partner" ? view.rows.find((r) => r.id === open.id) ?? null : null;
  const brief = open?.kind === "mission" ? view.briefs.find((b) => b.id === open.id) ?? null : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4" aria-labelledby="funnel-h">
        <div className="flex flex-col gap-1">
          <h2 id="funnel-h" className="h2">
            Find and onboard
          </h2>
          <Meta>Every partner moves through the same four stages. Onboarding is done when the founder has rated their first piece of work.</Meta>
        </div>
        <ol className="grid gap-3 md:grid-cols-4">
          {view.funnel.map((st) => (
            <li key={st.key} className="tile flex flex-col gap-3 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="eyebrow">{st.label}</span>
                <span className="font-display text-[22px] text-ink">{st.partners.length}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {st.partners.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="text-left" onClick={() => setOpen({ kind: "partner", id: p.id })} aria-haspopup="dialog">
                      <span className="block text-[13px] font-medium text-ink hover:text-lime">{p.name}</span>
                      <span className="meta block">{st.key === "active" ? p.focus : (p.note ?? p.focus)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="crm-h">
        <h2 id="crm-h" className="h2">
          All partners
        </h2>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-tile border border-line-2 bg-surface p-4">
          <SegmentedFilter
            label="Type"
            options={view.groups.map((g) => ({ ...g, count: view.rows.filter((r) => r.group === g.key && (!stage || r.stage === stage)).length }))}
            value={group}
            onChange={setGroup}
            total={view.rows.filter((r) => !stage || r.stage === stage).length}
          />
          <SegmentedFilter
            label="Stage"
            options={view.funnel.map((f) => ({
              key: f.key,
              label: f.label,
              count: view.rows.filter((r) => r.stage === f.key && (!group || r.group === group)).length,
            }))}
            value={stage}
            onChange={setStage}
            total={view.rows.filter((r) => !group || r.group === group).length}
          />
          <p className="flex items-center gap-3 pb-2 text-[13px] text-ink-3 lg:ml-auto" aria-live="polite">
            Showing {rows.length} of {view.rows.length}
            {(group || stage) && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setGroup(null);
                  setStage(null);
                }}
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
        <Tile className="py-2">
          <Table>
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th>Type</Th>
                <Th>What they do</Th>
                <Th>Stage</Th>
                <Th>Tools</Th>
                <Th>Companies</Th>
                <Th>Capacity</Th>
                <Th>Rating</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <button
                      type="button"
                      className="flex items-center gap-3 text-left"
                      onClick={() => setOpen({ kind: "partner", id: r.id })}
                      aria-haspopup="dialog"
                    >
                      <Monogram initials={r.initials} size={32} />
                      <span className="flex flex-col">
                        <span className="text-[14px] font-medium text-ink hover:text-lime">{r.name}</span>
                        <span className="meta">{r.focus}</span>
                      </span>
                    </button>
                  </Td>
                  <Td label="Type">{r.groupLabel}</Td>
                  <Td label="What they do" className="min-w-[220px] max-w-[320px] text-[13px]">
                    {r.what}
                  </Td>
                  <Td label="Stage">
                    <span className="flex flex-col gap-1">
                      <StatusDot tone={stageTone(r.stage)} label={r.stageLabel} />
                      {r.stage !== "active" && <span className="meta">{r.onboardingDone} of 4 onboarding steps</span>}
                    </span>
                  </Td>
                  <Td label="Tools" className="text-[13px]">
                    {r.tools.length ? r.tools.join(", ") : <span className="text-ink-3">Given at onboarding</span>}
                  </Td>
                  <Td label="Companies" className="text-[13px]">
                    {r.companies.length ? (
                      r.companies.map((c, i) => (
                        <span key={c.slug}>
                          {i > 0 && ", "}
                          {c.href ? (
                            <Link href={c.href} className="text-link">
                              {c.name}
                            </Link>
                          ) : (
                            c.name
                          )}
                        </span>
                      ))
                    ) : r.forDeal ? (
                      <Link href={r.forDeal.href} className="text-link">
                        {r.forDeal.codename} (if Rypples leads)
                      </Link>
                    ) : (
                      <span className="text-ink-3">None yet</span>
                    )}
                  </Td>
                  <Td label="Capacity">
                    {r.capacity ? (
                      <div className="flex min-w-[130px] flex-col gap-1.5">
                        <div className="h-[6px] w-full rounded-full bg-off" aria-hidden>
                          <div className={clsx("h-full rounded-full", r.capacity.pct >= 90 ? "bg-amber" : "bg-[rgb(255_255_255/0.5)]")} style={{ width: `${Math.min(100, r.capacity.pct)}%` }} />
                        </div>
                        <span className="meta">
                          <Illustrative>{r.capacity.hours}</Illustrative> · {r.capacity.pct}%
                        </span>
                      </div>
                    ) : (
                      <span className="meta">{r.engagement ?? "—"}</span>
                    )}
                  </Td>
                  <Td label="Rating">{r.rating != null ? <Illustrative>{r.rating.toFixed(1)}</Illustrative> : <span className="text-ink-3">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {rows.length === 0 && <p className="px-4 py-6 text-[14px] text-ink-3">No partners match these filters.</p>}
        </Tile>
        <Meta>
          Partner types: {view.types.map((t) => t.label).join(", ")}. New kinds of partner are added as a type, so the list can grow with the
          portfolio.
        </Meta>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="due-h">
        <h2 id="due-h" className="h2">
          Missions due
        </h2>
        <Tile className="py-2">
          <ul>
            {view.briefs.map((m) => (
              <li key={m.id} className="grid gap-2 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-medium text-ink">{m.title}</span>
                  <span className="meta">
                    {m.operator} · {m.company.name} · due {m.due}
                  </span>
                </div>
                <button type="button" className="text-link text-[13px]" onClick={() => setOpen({ kind: "mission", id: m.id })} aria-haspopup="dialog">
                  Open brief
                </button>
              </li>
            ))}
          </ul>
        </Tile>
      </section>

      <Sheet
        open={!!partner}
        onClose={() => setOpen(null)}
        title={partner ? `${partner.name} · ${partner.focus}` : ""}
        meta={partner ? `${partner.typeLabel} · ${partner.stageLabel}` : undefined}
        width={600}
      >
        {partner && <PartnerRecord r={partner} onBrief={(id) => setOpen({ kind: "mission", id })} />}
      </Sheet>

      <Sheet
        open={!!brief}
        onClose={() => setOpen(null)}
        title={brief?.title ?? ""}
        meta={brief ? `${brief.operator} · ${brief.company.name} · due ${brief.due}` : undefined}
      >
        {brief && <Brief b={brief} onPartner={() => setOpen({ kind: "partner", id: brief.partnerId })} />}
      </Sheet>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="h2">{title}</h3>
      {children}
    </div>
  );
}

function PartnerRecord({ r, onBrief }: { r: Row; onBrief: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-7">
      <Block title="What they do">
        <p className="text-[14px] text-ink-2">{r.what}</p>
        {r.stageNote && <p className="text-[14px] text-ink-2">{r.stageNote}</p>}
        <Meta>
          {r.group === "board_level"
            ? "External, not Rypples staff. One company each, on boards where Rypples holds a seat."
            : "Works across the portfolio."}
          {r.engagement ? ` ${r.engagement}.` : ""}
        </Meta>
      </Block>

      <Block title="Onboarding">
        <ol className="flex flex-col gap-2">
          {r.onboarding.map((st, i) => (
            <li key={st.key} className="grid grid-cols-[22px_1fr_auto] items-baseline gap-2 text-[14px]">
              <span className="font-display text-[16px] text-lime">{i + 1}</span>
              <span className={st.done ? "text-ink" : "text-ink-2"}>{st.label}</span>
              <span className={clsx("meta", st.done && "text-lime")}>{st.done ? "Done" : "To do"}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="Companies">
        {r.companies.length ? (
          <ul className="flex flex-col gap-1.5">
            {r.companies.map((c) => (
              <li key={c.slug} className="text-[14px]">
                {c.href ? (
                  <Link href={c.href} className="text-link">
                    {c.name}
                  </Link>
                ) : (
                  c.name
                )}
              </li>
            ))}
          </ul>
        ) : r.forDeal ? (
          <p className="text-[14px] text-ink-2">
            Lined up for{" "}
            <Link href={r.forDeal.href} className="text-link">
              {r.forDeal.codename}
            </Link>
            , if Rypples leads and takes a board seat.
          </p>
        ) : (
          <p className="text-[14px] text-ink-3">Assigned once onboarding starts.</p>
        )}
        {r.capacity && (
          <Meta>
            <Illustrative>{r.capacity.hours}</Illustrative> this quarter, {r.capacity.left} hours left.{r.capacity.note ? ` ${r.capacity.note}` : ""}
          </Meta>
        )}
      </Block>

      <Block title="Tools">
        {r.tools.length ? (
          <ul className="flex flex-wrap gap-2">
            {r.tools.map((t) => (
              <li key={t} className="rounded-pill border border-line-2 px-2.5 py-[3px] text-[12px] text-ink-2">
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-3">Captain, the Playbook and the founder ledger are given at the Playbook briefing.</p>
        )}
      </Block>

      {(r.programs.length > 0 || r.modules.length > 0) && (
        <Block title="What they deliver">
          <ul className="flex flex-col gap-3">
            {r.programs.map((p) => (
              <li key={p.id} className="flex flex-col gap-0.5 border-t border-line-2 pt-3 text-[14px]">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{p.name}</span>
                  {p.rating != null && (
                    <span className="meta">
                      Founder rating <Illustrative>{p.rating.toFixed(1)}</Illustrative>
                    </span>
                  )}
                </span>
                <span className="text-ink-2">{p.outcome}</span>
                <span className="meta">
                  {p.running.length ? `Running at ${p.running.join(", ")}` : "None running"} · {p.done} done
                </span>
              </li>
            ))}
            {r.modules.map((m) => (
              <li key={m.n} className="flex flex-col gap-0.5 border-t border-line-2 pt-3 text-[14px]">
                <span className="font-medium text-ink">
                  Growth Readiness {m.n} · {m.name}
                </span>
                {m.via && <span className="meta">Delivered through {m.via}</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(r.missions.length > 0 || r.commitments.length > 0) && (
        <Block title="Open work">
          <ul className="flex flex-col gap-2">
            {r.missions.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="text-ink">
                  {m.title} <span className="meta">· {m.company} · due {m.due}</span>
                </span>
                <button type="button" className="text-link shrink-0 text-[13px]" onClick={() => onBrief(m.id)}>
                  Open brief
                </button>
              </li>
            ))}
            {r.commitments
              .filter((c) => !r.missions.some((m) => m.title === c.title))
              .map((c) => (
                <li key={c.id} className="text-[14px] text-ink">
                  {c.title} <span className="meta">· {c.company} · due {c.due}</span>
                </li>
              ))}
          </ul>
        </Block>
      )}

      {r.talent && (
        <>
          <Block title="Key hires">
            <ul className="flex flex-col gap-2">
              {r.talent.roles.map((t) => (
                <li key={t.id} className="flex flex-col text-[14px]">
                  <span className="text-ink">
                    {t.role} ·{" "}
                    <Link href={`/os/companies/${t.slug}`} className="text-link">
                      {t.company}
                    </Link>
                  </span>
                  <span className="meta">
                    {t.why} · <Illustrative>{t.state}</Illustrative>
                  </span>
                </li>
              ))}
            </ul>
          </Block>
          <Block title="Candidate bench">
            <p className="text-[14px] text-ink-2">
              <Illustrative>{r.talent.benchTotal}</Illustrative> vetted people ready to be introduced to founders.
            </p>
            <ul>
              {r.talent.bench.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-4 border-t border-line-2 py-2 text-[14px]">
                  <span className="text-ink-2">{g.label}</span>
                  <Illustrative>{g.n}</Illustrative>
                </li>
              ))}
            </ul>
          </Block>
        </>
      )}
    </div>
  );
}

function Brief({ b, onPartner }: { b: MissionBrief; onPartner: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <Meta>Brief assembled by Captain from the records · {b.domain}</Meta>
      <Block title="Context">
        <p className="text-[14px] text-ink-2">
          {b.context}{" "}
          <Link href={`/os/companies/${b.company.slug}`} className="text-link">
            Open {b.company.name}
          </Link>
        </p>
      </Block>
      <Block title="Constraint">
        <p className="text-[14px] text-ink-2">{b.constraint ?? "No open constraint is recorded for this company."}</p>
      </Block>
      <Block title="What good looks like">
        <p className="text-[14px] text-ink-2">{b.goodLooksLike}</p>
      </Block>
      <Block title="From the Playbook">
        {b.lessons.length === 0 ? (
          <p className="text-[14px] text-ink-3">No approved Playbook entry covers this domain yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {b.lessons.map((l) => (
              <li key={l.title} className="text-[14px] text-ink-2">
                {l.title} <span className="meta">· learned in {l.learnedIn}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="Three opening questions">
        <ol className="flex flex-col gap-2">
          {b.questions.map((q, i) => (
            <li key={i} className="grid grid-cols-[22px_1fr] text-[14px] text-ink-2">
              <span className="font-display text-[16px] text-lime">{i + 1}</span>
              {q}
            </li>
          ))}
        </ol>
      </Block>
      <Block title="When you deliver">
        <p className="text-[14px] text-ink-2">{b.whenYouDeliver}</p>
      </Block>
      <button type="button" className="text-link self-start text-[13px]" onClick={onPartner}>
        Open the {b.operator} record →
      </button>
    </div>
  );
}
