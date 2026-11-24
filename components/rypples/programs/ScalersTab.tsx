"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { act } from "@/lib/actions";
import { Button, Illustrative, Meta, Pill, StatusDot, Tile } from "@/components/ui";
import { Modal } from "@/components/ui/client";
import type { getScalers } from "@/lib/data/projections/founder-programs";

type View = NonNullable<ReturnType<typeof getScalers>>;

const selectCls = "well w-full rounded-item px-3 py-2 text-[14px] text-ink";

export function ScalersTab({ view }: { view: View }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [swapOpen, setSwapOpen] = useState(false);
  const [outId, setOutId] = useState("");
  const [inId, setInId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cand = view.candidates.find((c) => c.id === inId) ?? null;
  const problems = useMemo(() => (!cand ? [] : outId ? cand.byOut[outId] ?? [] : cand.intrinsic), [cand, outId]);
  const valid = !!cand && !!outId && problems.length === 0;

  const invite = () =>
    start(async () => {
      setError(null);
      const res = await act("circle.invites_sent", { circle_id: view.circleId }, { actor: "jerome", entityType: "circle", entityId: view.circleId });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  const swap = () =>
    start(async () => {
      setError(null);
      const res = await act(
        "circle.member_swapped",
        { circle_id: view.circleId, out_company_id: outId, in_company_id: inId },
        { actor: "jerome", entityType: "circle", entityId: view.circleId },
      );
      if (!res.ok) return setError(res.error);
      setSwapOpen(false);
      setOutId("");
      setInId("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[26px] font-medium tracking-[-0.02em] text-ink">
            {view.name.replace("Ocean Scalers, ", "")} · {view.theme}
          </h2>
          <Meta>{view.session}</Meta>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setSwapOpen(true)} aria-haspopup="dialog">
            Swap a member
          </Button>
          {view.invitesSent ? (
            <Button variant="done" disabled>
              Invitations sent
            </Button>
          ) : (
            <Button variant="primary" onClick={invite} disabled={pending}>
              Send invitations
            </Button>
          )}
        </div>
      </div>
      {error && !swapOpen && (
        <p role="alert" className="text-[13px] text-amber">
          {error}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Circle members">
        {view.members.map((m) => (
          <li key={m.id}>
            <Tile className="flex h-full flex-col gap-3 p-5">
              <Link href={`/os/companies/${m.slug}`} className="font-display text-[20px] font-bold tracking-[-0.01em] text-ink hover:text-lime">
                {m.name}
              </Link>
              <div className="flex flex-wrap gap-2">
                {m.vertical && <Pill>{m.vertical}</Pill>}
                {m.stage && <Pill grey>{m.stage}</Pill>}
                {m.region && <Pill grey>{m.region}</Pill>}
              </div>
            </Tile>
          </li>
        ))}
      </ul>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="flex flex-col gap-4" aria-labelledby="rule-h">
          <h2 id="rule-h" className="h2">
            Composition rule
          </h2>
          <Tile>
            <p className="text-[14px] text-ink-2">{view.rule}</p>
          </Tile>
        </section>
        <section className="flex flex-col gap-4" aria-labelledby="ex-h">
          <h2 id="ex-h" className="h2">
            Left out of this circle
          </h2>
          <Tile className="py-2">
            <ul>
              {view.excluded.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-2 py-3 last:border-b-0">
                  <span className="text-[14px] font-medium text-ink">{e.name}</span>
                  <span className="text-[13px] text-ink-2">{e.reason}</span>
                </li>
              ))}
            </ul>
          </Tile>
        </section>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="since-h">
        <h2 id="since-h" className="h2">
          Since session 2
        </h2>
        <Tile className="py-2">
          <ul>
            {view.commitments.map((c) => (
              <li key={c.id} className="grid gap-2 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[160px_1fr_110px] sm:items-baseline sm:gap-6">
                <span className="text-[14px] font-medium text-ink">{c.company}</span>
                <span className="text-[14px] text-ink-2">
                  <Illustrative>{c.text}</Illustrative>
                </span>
                <StatusDot tone={c.status === "done" ? "lime" : c.status === "at_risk" ? "amber" : "neutral"} label={c.status === "done" ? "Done" : c.status === "at_risk" ? "At risk" : "Open"} />
              </li>
            ))}
          </ul>
        </Tile>
      </section>

      <Modal
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title="Swap a member"
        footer={
          <>
            <Button variant="outline" onClick={() => setSwapOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={swap} disabled={!valid || pending}>
              Confirm swap
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">Each choice is checked against the composition rule: {view.rule}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="swap-out" className="meta">
              Member who leaves
            </label>
            <select id="swap-out" className={selectCls} value={outId} onChange={(e) => setOutId(e.target.value)}>
              <option value="">Choose a member</option>
              {view.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="swap-in" className="meta">
              Company who joins
            </label>
            <select id="swap-in" className={selectCls} value={inId} onChange={(e) => setInId(e.target.value)}>
              <option value="">Choose a company</option>
              {view.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div aria-live="polite" className="min-h-[44px]">
            {cand && problems.length > 0 && (
              <ul className="flex flex-col gap-1" data-testid="swap-warning">
                {problems.map((p) => (
                  <li key={p} className="flex gap-2 text-[13px] text-amber">
                    <span aria-hidden className="mt-[7px] inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-amber" />
                    <span>
                      <span className="sr-only">Breaks the rule: </span>
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {cand && problems.length === 0 && !outId && <Meta>Choose who leaves the circle to finish the check.</Meta>}
            {valid && <StatusDot tone="lime" label="Fits the composition rule" />}
            {error && (
              <p role="alert" className="text-[13px] text-amber">
                {error}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
