import { Meta, Tile } from "@/components/ui";
import type { getReadiness } from "@/lib/data/projections/engine";

export function ReadinessTab({ modules }: { modules: ReturnType<typeof getReadiness> }) {
  return (
    <Tile className="py-2">
      <ol>
        {modules.map((m) => (
          <li key={m.id} className="grid grid-cols-[44px_1fr] gap-4 border-b border-line-2 py-5 last:border-b-0 sm:grid-cols-[44px_260px_1fr_auto] sm:items-baseline sm:gap-6">
            <span className="font-display text-[22px] text-lime">{m.n}</span>
            <span className="text-[15px] font-medium text-ink">{m.name}</span>
            <span className="col-start-2 text-[14px] text-ink-2 sm:col-start-auto">{m.outcome}</span>
            <Meta className="col-start-2 sm:col-start-auto">{m.domain}</Meta>
          </li>
        ))}
      </ol>
    </Tile>
  );
}
