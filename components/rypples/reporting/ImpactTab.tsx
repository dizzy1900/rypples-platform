import Link from "next/link";
import { Illustrative, Meta, SourceChip, StatusDot, Table, Td, Th, Tile } from "@/components/ui";
import type { getImpact } from "@/lib/data/projections/reporting";

const LABEL = { reported: "Reported", in_progress: "In progress", not_yet: "Not yet" } as const;

export function ImpactTab({ view }: { view: ReturnType<typeof getImpact> }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="h2">Ocean Impact Navigator</h2>
        <span className="flex items-center gap-3">
          <Meta>
            {view.reported} of {view.rows.length} reporting
          </Meta>
          {view.framework && <SourceChip href={view.framework.href} label="About the framework" title={`${view.framework.label}: Ocean Impact Navigator`} />}
        </span>
      </div>
      <Tile className="py-2">
        <Table>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Headline measure</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/os/companies/${r.slug}`} className="font-medium text-ink hover:text-lime">
                    {r.company}
                  </Link>
                </Td>
                <Td>
                  <Illustrative>{r.kpi}</Illustrative>
                </Td>
                <Td>
                  <StatusDot tone={r.status === "reported" ? "lime" : "neutral"} label={LABEL[r.status]} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Tile>
    </div>
  );
}
