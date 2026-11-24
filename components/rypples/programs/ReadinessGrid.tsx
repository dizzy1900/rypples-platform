import Link from "next/link";
import { Illustrative, Meta, Section, StatBlock, StatusDot, Table, Td, Th, Tile } from "@/components/ui";
import type { getReadinessGrid, ReadinessStatus } from "@/lib/data/projections/founder-programs";

type View = ReturnType<typeof getReadinessGrid>;

export const readinessTone = (st: ReadinessStatus) => (st === "done" ? "lime" : st === "in_progress" ? "amber" : "neutral");

export function ReadinessGrid({ view }: { view: View }) {
  const c = view.counts;
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <p className="text-[15px] text-ink-2">
          Five modules that get a company ready to scale. There are no cohorts: each company takes only the modules its diagnostic recommends, when
          it needs them, delivered by the named expert from its 400-hour Growth Engine allocation.
        </p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <StatBlock value={c.companies} label="Companies taking modules" />
          <StatBlock value={c.inProgress} label="In progress" />
          <StatBlock value={c.recommended} label="Recommended, not started" />
          <StatBlock value={c.done} label="Done" />
        </div>
      </div>

      <Section id="modules" title="The five modules" meta="What each one delivers, and who delivers it">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {view.modules.map((m) => (
            <li key={m.id} className="tile flex flex-col gap-3 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[22px] text-lime">{m.n}</span>
                <span className="eyebrow">{m.focus}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-ink">{m.name}</span>
                <span className="text-[13px] text-ink-2">{m.outcome}</span>
                <span className="text-[12px] text-ink-3">Lifts the {m.domain} score</span>
              </div>
              <span className="meta mt-auto">
                {m.expertId ? (
                  <Link href={`/os/operating-partners?partner=${m.expertId}`} className="text-link underline underline-offset-2">
                    {m.expert}
                  </Link>
                ) : (
                  "Unassigned"
                )}
                {m.via ? ` · through ${m.via}` : ""}
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line-2 pt-2 text-[12px] text-ink-3">
                <span>{m.inProgress} in progress</span>
                <span>{m.recommended} recommended</span>
                <span>{m.done} done</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="companies" title="Where each company is" meta="A dash means the diagnostic doesn't call for that module">
        <Tile className="py-2">
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                {view.modules.map((m) => (
                  <Th key={m.id}>
                    {m.n} {m.name}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="flex flex-col gap-0.5">
                      <Link href={`/os/companies/${r.slug}`} className="text-link text-[14px] font-medium">
                        {r.name}
                      </Link>
                      {r.constraint && <span className="meta">{r.constraint}</span>}
                    </span>
                  </Td>
                  {r.cells.map((cell, i) => (
                    <Td key={cell.moduleId} label={`${view.modules[i]!.n} ${view.modules[i]!.name}`} className="min-w-[140px] align-top">
                      {cell.status === "not_needed" ? (
                        <span className="text-ink-4" aria-label="Not needed">
                          —
                        </span>
                      ) : (
                        <span className="flex flex-col gap-1">
                          <StatusDot tone={readinessTone(cell.status)} label={cell.label} />
                          {cell.output && (
                            <span className="text-[12px] leading-[1.4] text-ink-2">
                              <Illustrative>{cell.output}</Illustrative>
                            </span>
                          )}
                          {cell.note && <span className="text-[12px] leading-[1.4] text-ink-3">{cell.note}</span>}
                        </span>
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Tile>
      </Section>

      {view.waiting.length > 0 && (
        <Section id="waiting" title="Recommended, not started" meta="Agree a start with the founder, or record why not">
          <Tile className="py-2">
            <ul>
              {view.waiting.map((w) => (
                <li key={w.id} className="grid gap-1 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[200px_1fr_auto] sm:items-baseline sm:gap-6">
                  <Link href={`/os/companies/${w.slug}`} className="text-link text-[14px] font-medium">
                    {w.company}
                  </Link>
                  <span className="text-[14px] text-ink">
                    {w.module}
                    {w.constraint && <span className="meta"> · recommended for its {w.constraint.toLowerCase()} constraint</span>}
                  </span>
                  <span className="meta">
                    {w.expert ?? "Unassigned"}
                    {w.via ? ` · through ${w.via}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Tile>
        </Section>
      )}

      <Meta>A finished module&rsquo;s output becomes evidence in the company&rsquo;s next diagnostic.</Meta>
    </div>
  );
}
