import Link from "next/link";
import { Illustrative, Paper } from "@/components/ui";
import { PrintButton } from "./SchedulePrint";
import type { getSchedule } from "@/lib/data/projections/company";

type Sched = NonNullable<ReturnType<typeof getSchedule>>;

const RIGHTS = [
  "Choose which programs to start.",
  "Decline any program or introduction.",
  "Disagree with the binding constraint and have it reviewed.",
  "Rate every delivery. Ratings go to the CEO of Rypples unfiltered.",
  "Own the plan.",
];
const WILL_NOT = [
  "Take operational control.",
  "Hire or fire on the founder's behalf.",
  "Require exclusivity on introductions.",
  "Share Rypples OS records with co-investors.",
];
const MEASURED = [
  "Days to clear the binding constraint, against the benchmark for that domain.",
  "Delivery against the allocation.",
  "Founder ratings.",
];

function H({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-8 break-after-avoid text-[17px] font-semibold tracking-[-0.01em]">
      <span className="mr-2 text-[13px] opacity-75">{n}.</span>
      {children}
    </h2>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px]">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

/** One-page annex that would sit in an Anchor term sheet. Generated from data, no AI. */
export function Schedule({ s, backHref, backLabel = "Back to company" }: { s: Sched; backHref: string; backLabel?: string }) {
  const a = s.allocation;
  return (
    <>
      <style>{`@media print { .bg-abyss, #main { background: #fff !important; box-shadow: none !important; } #main { border-radius: 0 !important; } .paper { background: #fff !important; padding: 0 !important; border-radius: 0 !important; } .paper h2 { break-after: avoid; } .paper li, .paper tr { break-inside: avoid; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link href={backHref} className="text-link text-[13px]">
          ← {backLabel}
        </Link>
        <PrintButton />
      </div>

      <Paper>
        <p className="text-[12px] font-medium uppercase tracking-[0.2em] opacity-75">Annex to the term sheet</p>
        <h1 className="mt-2 text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">Growth Engine schedule</h1>
        <p className="mt-1 text-[15px] opacity-70">{s.company.name}</p>

        <H n={1}>Parties and purpose</H>
        <p className="mt-2 text-[14px]">
          This schedule sets out the help Rypples gives {s.company.name} as an Anchor company.
          {s.roundClose && <> Round close: {s.roundClose}.</>} {s.boardSeat ? "Rypples holds one board seat." : "Rypples does not hold a board seat."} Rypples leads
          with one board seat and a minority stake. Everything else is help the founder chooses.
        </p>

        <H n={2}>Allocation</H>
        {a ? (
          <p className="mt-2 text-[14px]">
            Funded by Rypples each year: <strong className="font-semibold"><Illustrative>{a.programs_total}</Illustrative> programs</strong> and{" "}
            <strong className="font-semibold"><Illustrative>{a.hours_total}</Illustrative> operator hours</strong>. So far{" "}
            <Illustrative>{s.used.programs}</Illustrative> of {a.programs_total} programs and <Illustrative>{s.used.hours}</Illustrative> of {a.hours_total} hours are used.
          </p>
        ) : (
          <p className="mt-2 text-[14px]">No allocation is recorded yet.</p>
        )}
        {s.enrolments.length > 0 && (
          <>
            <p className="mt-3 text-[13px] font-medium uppercase tracking-[0.12em] opacity-75">Chosen so far</p>
            <ul className="mt-1 space-y-1 text-[14px]">
              {s.enrolments.map((e) => (
                <li key={e.id}>
                  {e.name} · {e.status} · <Illustrative>{e.hours}</Illustrative> hours
                </li>
              ))}
            </ul>
          </>
        )}
        {s.boardPartner ? (
          <p className="mt-3 text-[14px]">
            Board-level partner: {s.boardPartner.role}, focus on {s.boardPartner.focus.toLowerCase()}.
          </p>
        ) : (
          <p className="mt-3 text-[14px]">Board-level partner: to be named.</p>
        )}

        <H n={3}>Programs available</H>
        <table className="mt-2 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[rgb(15_39_48/0.25)] text-[11px] uppercase tracking-[0.12em] opacity-70">
              <th className="py-2 pr-3 font-medium">Program</th>
              <th className="py-2 pr-3 font-medium">Outcome</th>
              <th className="py-2 pr-3 font-medium">Length</th>
              <th className="py-2 font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {s.programs.map((p) => (
              <tr key={p.id} className="border-b border-[rgb(15_39_48/0.12)] align-top">
                <td className="py-2 pr-3 font-medium">{p.name}</td>
                <td className="py-2 pr-3">{p.outcome}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{p.weeks} weeks</td>
                <td className="py-2 whitespace-nowrap">
                  <Illustrative>{p.hours}</Illustrative>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <H n={4}>Rypples&rsquo; promises</H>
        <ul className="mt-2 space-y-1 text-[14px]">
          {s.promises.map((p) => (
            <li key={p.id}>
              <strong className="font-semibold">{p.title}.</strong> {p.text}
            </li>
          ))}
        </ul>

        <H n={5}>Founder rights</H>
        <List items={RIGHTS} />

        <H n={6}>What Rypples will not do</H>
        <List items={WILL_NOT} />

        <H n={7}>How it&rsquo;s measured</H>
        <List items={MEASURED} />
        <p className="mt-2 text-[14px]">
          {s.constraint && (
            <>
              The reference for {s.constraint.domain.toLowerCase()} is <Illustrative>{s.constraint.days}</Illustrative> days ({s.constraint.label}).{" "}
            </>
          )}
          Reviewed at each quarterly board.
        </p>

        <H n={8}>Data</H>
        <p className="mt-2 text-[14px]">The founder chooses what co-investors see from Rypples Engine.</p>

        <p className="mt-10 border-t border-[rgb(15_39_48/0.2)] pt-4 text-[12px] opacity-70">
          Illustrative schedule for the prototype. Not legal terms.
        </p>
      </Paper>
    </>
  );
}
