/**
 * /os/_status (docs/10-security-cost-ops.md §4): spend, mode, circuit, recent runs and errors.
 * Visible only with the priority cookie; everyone else gets a 404. (The folder is `%5Fstatus`
 * because Next.js treats `_folders` as private and would not route them.)
 */
import { notFound } from "next/navigation";
import { hasPriority } from "@/lib/session";
import { budgetStatus, lastErrors } from "@/lib/ai/budget";
import { configuredModels } from "@/lib/ai/client";
import { getStore } from "@/lib/data";
import { H1, H2, Meta } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status", robots: { index: false } };

const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function StatusPage() {
  if (!(await hasPriority())) notFound();
  const [st, errors, runs] = await Promise.all([budgetStatus({ priority: true }), lastErrors(20), getStore().listAgentRuns(25)]);
  const c = st.config;
  const rows: [string, string][] = [
    ["Mode (any-company, priority view)", `${st.mode.mode}${st.mode.reason ? ` · ${st.mode.reason}` : ""}${st.mode.viaPriority ? " · via priority budget" : ""}`],
    ["LIVE_AI", c.liveAi ? "on" : "off"],
    ["API key", c.hasKey ? "set" : "missing"],
    ["Spend today (public)", `${usd(st.spend.public)} of ${usd(c.dailyUsd)}`],
    ["Spend today (priority)", `${usd(st.spend.priority)} of ${usd(c.priorityUsd)}`],
    ["F2 daily runs cap", String(c.f2DailyRuns)],
    ["Circuit breaker", st.circuitOpen ? "open (cached for 10 minutes)" : "closed"],
    ["Budget store", st.store],
    ["Data store", getStore().kind],
    ["Models", configuredModels().join(", ")],
  ];
  return (
    <div className="flex flex-col gap-10 pb-16">
      <div className="flex flex-col gap-2">
        <H1>Status</H1>
        <Meta>{st.date} (UTC)</Meta>
      </div>
      <section className="flex flex-col gap-3">
        <H2>Budget and mode</H2>
        <dl className="tile grid grid-cols-1 gap-x-6 gap-y-2 p-5 text-[14px] sm:grid-cols-[minmax(0,240px)_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <H2>Per flow today</H2>
        <div className="tile overflow-x-auto p-5">
          <table className="w-full text-left text-[14px]">
            <thead className="text-ink-3">
              <tr>
                <th className="py-1 pr-4 font-medium">Flow</th>
                <th className="py-1 pr-4 font-medium">Live runs</th>
                <th className="py-1 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody>
              {st.perFlow.map((f) => (
                <tr key={f.flow} className="border-t border-line-2">
                  <td className="py-1.5 pr-4">{f.flow}</td>
                  <td className="py-1.5 pr-4">{f.runs}</td>
                  <td className="py-1.5">{usd(f.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <H2>Recent runs</H2>
        <div className="tile overflow-x-auto p-5">
          <table className="w-full text-left text-[13px]">
            <thead className="text-ink-3">
              <tr>
                {["Started", "Flow", "Mode", "Status", "Model", "Searches", "Cost", "Error"].map((h) => (
                  <th key={h} className="py-1 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line-2 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-4">{r.started_at.slice(0, 19).replace("T", " ")}</td>
                  <td className="py-1.5 pr-4">{r.flow}</td>
                  <td className="py-1.5 pr-4">{r.mode}</td>
                  <td className="py-1.5 pr-4">{r.status}</td>
                  <td className="py-1.5 pr-4">{r.model ?? ""}</td>
                  <td className="py-1.5 pr-4">{r.searches}</td>
                  <td className="py-1.5 pr-4">{usd(r.est_cost_usd)}</td>
                  <td className="py-1.5 text-amber">{r.error ?? ""}</td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={8} className="py-2 text-ink-3">
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <H2>Last errors</H2>
        <ul className="tile flex flex-col gap-1 p-5 text-[13px]">
          {errors.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="text-ink-3">
                {e.at} · {e.flow}
              </span>{" "}
              {e.message}
            </li>
          ))}
          {!errors.length && <li className="text-ink-3">None.</li>}
        </ul>
      </section>
    </div>
  );
}
