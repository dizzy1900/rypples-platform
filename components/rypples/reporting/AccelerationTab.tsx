"use client";
import { useState } from "react";
import { Illustrative, Meta, Table, Td, Th, Tile } from "@/components/ui";
import { ChipGroup } from "@/components/ui/client";
import { LearningCurve } from "@/components/rypples/LearningCurve";
import type { DomainSlug } from "@/lib/domain/schemas";
import type { getAcceleration } from "@/lib/data/projections/reporting";

type View = ReturnType<typeof getAcceleration>;

export function AccelerationTab({ view }: { view: View }) {
  const [domain, setDomain] = useState<DomainSlug | null>(null);
  const labels = Object.fromEntries(view.domains.map((d) => [d.slug, d.label]));
  const sel = view.domains.find((d) => d.slug === domain) ?? null;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4" aria-labelledby="curve-h">
        <h2 id="curve-h" className="h2">
          The learning curve
        </h2>
        <Tile className="flex flex-col gap-5">
          <ChipGroup
            label="Filter the curve by domain"
            value={domain}
            onChange={setDomain}
            options={view.domains.map((d) => ({ key: d.slug, label: d.label }))}
          />
          <p className="meta" aria-live="polite" data-testid="case-count">
            {sel ? `${sel.n} of ${view.threshold} cases · benchmark switches to Rypples data at ${view.threshold}` : `${view.total} cleared cases across ${view.domains.filter((d) => view.cases.some((c) => c.domain_id === d.slug)).length} of ${view.domains.length} domains`}
          </p>
          <LearningCurve cases={view.cases} benchmarks={view.benchmarks} domain={domain} domainLabels={labels} />
        </Tile>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="bm-h">
        <h2 id="bm-h" className="h2">
          Benchmarks
        </h2>
        <Tile className="py-2">
          <Table>
            <thead>
              <tr>
                <Th>Constraint</Th>
                <Th>Days</Th>
                <Th>Source</Th>
                <Th>Rypples cases</Th>
                <Th>Confidence</Th>
              </tr>
            </thead>
            <tbody>
              {view.table.map((r) => (
                <tr key={r.slug}>
                  <Td className="font-medium text-ink">{r.constraint}</Td>
                  <Td label="Days">
                    <Illustrative note={r.sourceNote}>{r.days}</Illustrative>
                  </Td>
                  <Td label="Source">{r.source}</Td>
                  <Td label="Rypples cases">
                    {r.cases} of {view.threshold}
                  </Td>
                  <Td label="Confidence" className="capitalize">{r.confidence}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tile>
        <Meta>The outside references are placeholders until they are sourced, for example from published research on how climate hardware companies scale.</Meta>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="flex flex-col gap-4" aria-labelledby="how-h">
          <h2 id="how-h" className="h2">
            How acceleration is measured
          </h2>
          <ul className="flex flex-col gap-3 text-[14px] text-ink-2">
            <li className="flex gap-3">
              <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-lime" />
              When a confirmed constraint clears, the days it took become a case, with no company named.
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-lime" />
              Each case is compared with its domain’s benchmark: an outside reference until Rypples has {view.threshold} cases there, then the median of Rypples’ own.
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-lime" />
              The curve plots cases in the order they cleared, with a rolling median over the last four.
            </li>
          </ul>
        </section>
        <section className="flex flex-col gap-4" aria-labelledby="cant-h">
          <h2 id="cant-h" className="h2">
            What can’t be measured
          </h2>
          <p className="text-[14px] text-ink-2">
            What a company would have done without Rypples. There’s no true counterfactual, so these are signals, not proof.
          </p>
        </section>
      </div>
    </div>
  );
}
