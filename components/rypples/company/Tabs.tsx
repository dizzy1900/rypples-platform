import Link from "next/link";
import {
  EmptyState,
  Illustrative,
  Meta,
  Monogram,
  Prov,
  ScoreBar,
  SourceChip,
  StatBlock,
  StatusDot,
  Table,
  Td,
  Th,
  TextLink,
} from "@/components/ui";
import { ProposeReview } from "./ProposeReview";
import { MarketClient } from "./MarketClient";
import type { getCompanyView } from "@/lib/data/projections/company";

type Full = Extract<NonNullable<ReturnType<typeof getCompanyView>>, { kind: "full" }>;

export function DiagnosticTab({ v }: { v: Full }) {
  const d = v.diagnostic;
  if (!d) return <EmptyState>No diagnostic yet.</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      <Meta>{d.meta}</Meta>
      <ul>
        {d.rows.map((r) => (
          <li key={r.domain} className="grid gap-2 border-b border-line-2 py-4 lg:grid-cols-[200px_190px_1fr] lg:gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-medium text-ink">{r.label}</span>
              {r.binding && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">Binding</span>}
            </div>
            <div className="flex items-start">
              {r.score != null && r.provenance !== "public" ? (
                <Illustrative note="Exact score values are illustrative">
                  <ScoreBar score={r.score} binding={r.binding} label={r.label} />
                </Illustrative>
              ) : (
                <ScoreBar score={r.score} binding={r.binding} label={r.label} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[14px] text-ink-2">
                {r.score == null ? "Nothing public on this domain yet." : r.finding}
                {r.score == null && r.note && <span className="text-ink-3"> {r.note}.</span>}
              </p>
              {r.sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.sources.map((s) => (
                    <SourceChip key={s.id} href={s.href} label={s.label} />
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RisksTab({ v }: { v: Full }) {
  const r = v.risks;
  return (
    <div className="flex flex-col gap-5">
      <Table>
        <thead>
          <tr>
            <Th>Hypothesis to evidence</Th>
            <Th>Test</Th>
            <Th>State</Th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.id}>
              <Td className="text-ink">{x.risk}</Td>
              <Td>{x.test}</Td>
              <Td>
                <StatusDot tone={x.amber ? "amber" : "neutral"} label={<Prov p={x.provenance}>{x.state}</Prov>} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="meta">The Field Reliability Review program can close the first two.</p>
      {r.canPropose && (
        <div>
          <ProposeReview companyId={r.companyId} done={r.proposed} />
        </div>
      )}
    </div>
  );
}

export function MarketTab({ markets }: { markets: { markets: import("@/lib/geo/schema").Market[]; pins: import("@/lib/geo/schema").Pin[]; datasets: import("@/lib/geo/schema").Dataset[] } | null }) {
  if (!markets) return <EmptyState>Market data is not available in this build.</EmptyState>;
  return <MarketClient markets={markets.markets} pins={markets.pins} datasets={markets.datasets} />;
}

export function ProgramsTab({ v }: { v: Full }) {
  const p = v.programs;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Meta>Growth Engine allocation · From the term sheet</Meta>
        <div className="grid gap-8 sm:grid-cols-2">
          <StatBlock
            value={
              <Illustrative>{p.used.programs}</Illustrative>
            }
            label={`of ${p.allocation?.programs_total ?? "-"} programs this year`}
          />
          <StatBlock
            value={<Illustrative>{p.used.hours}</Illustrative>}
            label={
              <>
                of {p.allocation?.hours_total ?? "-"} operator hours
                {p.used.requestedHours > 0 && ` · ${p.used.requestedHours} more requested, counted once running`}
              </>
            }
          />
        </div>
      </div>
      {p.enrolments.length === 0 ? (
        <EmptyState>No programs started yet.</EmptyState>
      ) : (
        <ul>
          {p.enrolments.map((e) => (
            <li key={e.id} className="grid grid-cols-[40px_1fr] items-center gap-x-4 gap-y-1 border-b border-line-2 py-4 sm:grid-cols-[40px_1fr_auto]">
              <Monogram initials={e.operatorInitials} />
              <span className="flex flex-col">
                <span className="text-[14px] font-medium text-ink">{e.name}</span>
                <span className="text-[13px] text-ink-3">{e.operatorRole}</span>
              </span>
              <span className="col-start-2 sm:col-start-3">
                <StatusDot tone={e.tone} label={e.state} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <TextLink href={`/os/companies/${v.head.slug}/schedule`}>View the Growth Engine schedule →</TextLink>
      </div>
    </div>
  );
}

const STATUS: Record<string, { tone: "lime" | "amber" | "neutral"; label: string }> = {
  delivered: { tone: "lime", label: "Delivered" },
  in_progress: { tone: "neutral", label: "In progress" },
  open: { tone: "neutral", label: "Open" },
  not_started: { tone: "neutral", label: "Not started" },
};

export function LedgerTab({ v }: { v: Full }) {
  const l = v.ledger;
  return (
    <div className="flex flex-col gap-5">
      <h3 className="h2">
        How {v.ceoFirst} rates Rypples{" "}
        {l.rating != null ? <Illustrative>{l.rating.toFixed(1)}</Illustrative> : "(not yet rated)"} / 5 across {l.delivered} delivered{" "}
        {l.delivered === 1 ? "commitment" : "commitments"}
      </h3>
      {l.rows.length === 0 ? (
        <EmptyState>No commitments yet.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Commitment</Th>
              <Th>From</Th>
              <Th>Due</Th>
              <Th>Status</Th>
              <Th>Rating</Th>
            </tr>
          </thead>
          <tbody>
            {l.rows.map((r) => {
              const st = STATUS[r.status] ?? STATUS.open;
              return (
                <tr key={r.id}>
                  <Td className="text-ink">{r.title}</Td>
                  <Td>{r.from}</Td>
                  <Td>{r.due}</Td>
                  <Td>
                    <StatusDot tone={st.tone} label={st.label} />
                  </Td>
                  <Td>{r.rating != null ? <Illustrative>{r.rating} / 5</Illustrative> : r.status === "delivered" ? "Not yet rated" : ""}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <div>
        <TextLink href={`/bridge/${v.head.slug}`}>See the ledger {v.ceoFirst} sees →</TextLink>
      </div>
    </div>
  );
}

export function BoardTab({ v }: { v: Full }) {
  const b = v.board;
  return (
    <ul>
      {b.past.map((m) => (
        <li key={m.id} className="grid gap-1 border-b border-line-2 py-4 sm:grid-cols-[140px_1fr_auto] sm:items-baseline sm:gap-5">
          <span className="meta uppercase tracking-[0.12em]">{m.when} · Last meeting</span>
          <span className="flex flex-col">
            <span className="text-[14px] font-medium text-ink">{m.label}</span>
            {m.note && <span className="text-[13px] text-ink-3">{m.note}</span>}
          </span>
          <Link href={`?tab=diagnostic`} className="text-link text-[13px]">
            Open the diagnostic →
          </Link>
        </li>
      ))}
      {b.next && (
        <li className="grid gap-1 border-b border-line-2 py-4 sm:grid-cols-[140px_1fr_auto] sm:items-baseline sm:gap-5">
          <span className="meta uppercase tracking-[0.12em]">{b.next.label} · Next</span>
          <span className="flex flex-col">
            <span className="text-[14px] font-medium text-ink">{b.packQuarter ? `${b.packQuarter} board pack` : "Board meeting"}</span>
            {b.packState && <span className="text-[13px] text-ink-3">{b.packState}</span>}
            {b.next.note && <span className="text-[13px] text-ink-3">{b.next.note}</span>}
          </span>
          <Link href={`/bridge/${v.head.slug}/board-pack`} className="text-link text-[13px]">
            Open the pack →
          </Link>
        </li>
      )}
      {b.past.length === 0 && !b.next && <EmptyState>No board meetings yet.</EmptyState>}
    </ul>
  );
}
