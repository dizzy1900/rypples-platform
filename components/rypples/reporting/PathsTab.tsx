import Link from "next/link";
import { Illustrative, Meta, SourceChip, Table, Td, Th, Tile } from "@/components/ui";
import type { getPaths } from "@/lib/data/projections/reporting";

export function PathsTab({ view }: { view: ReturnType<typeof getPaths> }) {
  return (
    <div className="flex flex-col gap-4">
      <Tile className="py-2">
        <Table>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Relationships today</Th>
              <Th>Likely buyers and acquirers</Th>
              <Th>Program status</Th>
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
                <Td label="Relationships today">
                  <div className="flex flex-col gap-1.5">
                    <span>{r.nowProvenance === "illustrative" ? <Illustrative>{r.now}</Illustrative> : r.now}</span>
                    {r.source && (
                      <span>
                        <SourceChip href={r.source.href} label={r.source.label} />
                      </span>
                    )}
                    {r.note && <Meta>{r.note}</Meta>}
                  </div>
                </Td>
                <Td label="Likely buyers and acquirers">{r.exited ? r.likely : <Illustrative note="A hypothesis, not a prediction">{r.likely}</Illustrative>}</Td>
                <Td label="Program status">{r.program}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Tile>
      <Meta>Relationships come from public sources and carry their source. Likely buyers and acquirers are categories we hypothesise, not predictions.</Meta>
    </div>
  );
}
