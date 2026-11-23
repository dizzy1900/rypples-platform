"use client";
/** S5b input page: name or website in, streamed run, then the run page (or a calm outcome panel). */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Section, Tile } from "@/components/ui";
import { useFlow } from "@/lib/ai/useFlow";
import type { AnyCompanyResult, RecentRun } from "@/lib/ai/types";
import { F2Progress } from "./F2Progress";
import { hostOf } from "./ScoreList";

const PAUSED = "Live runs are paused for today. You can open any recent run.";

export function AnyCompanyInput({
  initialQuery,
  mode,
  recent,
  examples,
}: {
  initialQuery: string;
  mode: "live" | "cached";
  recent: RecentRun[];
  examples: { name: string; website: string }[];
}) {
  const router = useRouter();
  const flow = useFlow<AnyCompanyResult>("any-company");
  const [query, setQuery] = useState(initialQuery.slice(0, 200));
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const cached = mode === "cached";
  const running = flow.status === "running";

  const run = async (q: string) => {
    const v = q.trim().slice(0, 200);
    if (!v) return;
    setQuery(v);
    setLastQuery(v);
    const r = await flow.start({ query: v });
    const st = r?.data?.status;
    if (r && (st === "ok" || st === "insufficient")) router.push(`/os/diagnostic/runs/${r.id}`);
  };

  const res = flow.result?.data ?? null;
  const pausedMsg = flow.fallback && !flow.fallback.replaying && !flow.result ? flow.fallback.message ?? PAUSED : null;
  const failed = flow.status === "error" || (flow.status === "done" && !flow.result && !pausedMsg);
  const navigating = !!res && (res.status === "ok" || res.status === "insufficient");

  return (
    <div className="flex flex-col gap-8">
      <Tile className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
        >
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="meta">Company name or website</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
              disabled={cached || running}
              placeholder="Company name or website"
              className="well w-full px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 disabled:opacity-50"
              data-autofocus
            />
          </label>
          <Button variant="primary" type="submit" disabled={cached || running || !query.trim()}>
            {running ? "Running…" : "Run diagnostic"}
          </Button>
        </form>
        {cached && <p className="text-[13px] text-ink-3">{PAUSED}</p>}

        {(running || navigating) && (
          <F2Progress steps={flow.steps} sources={flow.sources} evidenceCount={flow.evidence.length} replaying={flow.replaying} />
        )}

        {res?.status === "declined" && (
          <p className="text-[15px] text-ink-2" role="status">
            {res.identity.name || lastQuery} doesn&rsquo;t look like an ocean company: {res.identity.reason}. The diagnostic is tuned to the
            ocean economy.
          </p>
        )}
        {res?.status === "not_found" && (
          <p className="text-[15px] text-ink-2" role="status">
            Captain couldn&rsquo;t find a company called {lastQuery} in public sources. Try its website instead.
          </p>
        )}
        {res?.status === "ambiguous" && (
          <div className="flex flex-col gap-3" role="status">
            <p className="text-[15px] text-ink-2">
              More than one company matches {lastQuery}. Which one did you mean?
            </p>
            <ul className="flex flex-col gap-2">
              {res.candidates.slice(0, 3).map((c) => (
                <li key={`${c.name}-${c.website}`}>
                  <button
                    type="button"
                    onClick={() => run(c.website ?? c.name)}
                    className="flex w-full flex-wrap items-baseline justify-between gap-2 rounded-item border border-line-2 bg-surface px-4 py-3 text-left hover:border-lime-30"
                  >
                    <span className="text-[14px] font-medium text-ink">{c.name}</span>
                    <span className="meta">{c.website ? hostOf(c.website) : "no website found"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pausedMsg && (
          <p className="text-[14px] text-ink-2" role="status">
            {pausedMsg}
          </p>
        )}
        {failed && !running && (
          <div className="flex flex-wrap items-center gap-3" role="status">
            <p className="text-[14px] text-amber">Captain couldn&rsquo;t finish this run. Nothing was saved.</p>
            {lastQuery && (
              <Button onClick={() => run(lastQuery)} disabled={cached}>
                Try again
              </Button>
            )}
          </div>
        )}
      </Tile>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section id="recent" title="Recently run" meta="Shared across visitors. Open any run.">
          {recent.length ? (
            <ul className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <li key={r.run_id}>
                  <Link
                    href={`/os/diagnostic/runs/${r.run_id}`}
                    className="inline-flex items-center gap-2 rounded-btn border border-line-2 bg-surface px-3 py-1.5 text-[13px] text-ink-2 hover:border-lime-30 hover:text-ink"
                  >
                    {r.name}
                    {r.status !== "ok" && <span className="meta">{r.status === "insufficient" ? "thin record" : r.status}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-ink-3">No runs yet. The first one you start appears here for everyone.</p>
          )}
        </Section>
        <Section id="examples" title="Try a portfolio company">
          <ul className="flex flex-wrap gap-2">
            {examples.map((x) => (
              <li key={x.website}>
                <button
                  type="button"
                  disabled={cached || running}
                  onClick={() => run(x.website)}
                  className="rounded-btn border border-line-2 bg-surface px-3 py-1.5 text-[13px] text-ink-2 hover:border-lime-30 hover:text-ink disabled:opacity-40"
                >
                  {x.name}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
