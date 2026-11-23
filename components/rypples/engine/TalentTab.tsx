import Link from "next/link";
import { Illustrative, Meta, Table, Td, Th, Tile } from "@/components/ui";
import type { getTalent } from "@/lib/data/projections/engine";

type View = ReturnType<typeof getTalent>;

export function TalentTab({ view }: { view: View }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4" aria-labelledby="roles-h">
        <h2 id="roles-h" className="h2">
          Open roles
        </h2>
        <Tile className="py-2">
          <Table>
            <thead>
              <tr>
                <Th>Role</Th>
                <Th>Company</Th>
                <Th>Why</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {view.roles.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium text-ink">{r.role}</Td>
                  <Td label="Company">
                    <Link href={`/os/companies/${r.slug}`} className="text-link">
                      {r.company}
                    </Link>
                  </Td>
                  <Td label="Why">{r.why}</Td>
                  <Td label="State">
                    <Illustrative>{r.state}</Illustrative>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tile>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="flex flex-col gap-4" aria-labelledby="bench-h">
          <h2 id="bench-h" className="h2">
            The bench
          </h2>
          <Tile className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span className="big-number" data-testid="bench-total">
                <Illustrative>{view.benchTotal}</Illustrative>
              </span>
              <Meta>vetted people ready to be introduced, by group</Meta>
            </div>
            <ul>
              {view.bench.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-4 border-t border-line-2 py-3 text-[14px]">
                  <span className="text-ink-2">{g.label}</span>
                  <span className="font-display text-[18px] text-ink">
                    <Illustrative>{g.n}</Illustrative>
                  </span>
                </li>
              ))}
            </ul>
          </Tile>
        </section>

        {view.ceo && (
          <section className="flex flex-col gap-4" aria-labelledby="ceo-h">
            <h2 id="ceo-h" className="h2">
              CEO development
            </h2>
            <Tile className="flex flex-col gap-3">
              <p className="text-[15px] text-ink">Every Anchor CEO gets a day-100 360, a matched coach and an Ocean Scalers circle.</p>
              <p className="text-[14px] text-ink-2">
                {view.ceo.who}: <Illustrative>{view.ceo.note}</Illustrative>
              </p>
            </Tile>
          </section>
        )}
      </div>
    </div>
  );
}
