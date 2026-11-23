"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { act } from "@/lib/actions";
import { useFlow } from "@/lib/ai/useFlow";
import { Button, Meta, Paper, StatusDot, Tile } from "@/components/ui";
import { Popover, ProgressSteps } from "@/components/ui/client";
import type { getUpdate, DraftSegment } from "@/lib/data/projections/reporting";

type View = ReturnType<typeof getUpdate>;
const PROV = { public: "Public source", scenario: "Scenario record", illustrative: "Illustrative figure", generated: "Generated" } as const;
const humanise = (k: string) => k.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function RefText({ seg }: { seg: Extract<DraftSegment, { kind: "ref" }> }) {
  const r = seg.resolved;
  if (!r) {
    return (
      <span className="untraced" title="Not traced to an approved record">
        {seg.raw.id}
      </span>
    );
  }
  const ill = r.provenance === "illustrative";
  return (
    <Popover
      label={`Source of ${r.value}`}
      trigger={
        <span
          className={ill ? "ill font-medium" : "font-medium underline decoration-paper-ink/60 decoration-[1.5px] underline-offset-4 hover:decoration-paper-ink"}
          data-ref-type={seg.raw.type}
        >
          {r.value}
        </span>
      }
    >
      <span className="flex flex-col gap-2">
        <span className="meta">Record</span>
        <span className="text-ink">{r.label}</span>
        <span className="meta">Value</span>
        <span className="text-ink">{r.value}</span>
        <span className="meta">Provenance</span>
        <span className="text-ink">{PROV[r.provenance]}</span>
        {r.href && (
          <Link href={r.href} className="text-link">
            Open the record
          </Link>
        )}
      </span>
    </Popover>
  );
}

export function ShareholderUpdate({ view }: { view: View }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const flow = useFlow<unknown>("shareholder-update");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const locked = view.approved;
  const d = view.draft;

  const redraft = async () => {
    setError(null);
    const res = await flow.start({ quarter: view.quarter });
    const data = res?.data as { segments?: unknown } | undefined;
    if (res && data && Array.isArray(data.segments)) {
      const saved = await act("shareholder_update.redrafted", { quarter: view.quarter, draft: data, run_id: res.id }, { actor: "jerome", entityType: "shareholder_update", entityId: view.quarter });
      if (!saved.ok) setError(saved.error);
    }
    router.refresh();
  };

  const startEdit = () => {
    if (!d) return;
    setDrafts(Object.fromEntries(d.segments.flatMap((s) => (s.kind === "text" ? [[s.index, s.text]] : []))));
    setEditing(true);
  };

  const save = () =>
    start(async () => {
      if (!d) return;
      setError(null);
      for (const s of d.segments) {
        if (s.kind !== "text") continue;
        const next = drafts[s.index];
        if (next == null || next === s.text) continue;
        const res = await act("shareholder_update.edited", { quarter: view.quarter, segment_index: s.index, text: next }, { actor: "jerome", entityType: "shareholder_update", entityId: view.quarter });
        if (!res.ok) return setError(res.error);
      }
      setEditing(false);
      router.refresh();
    });

  const approve = () =>
    start(async () => {
      setError(null);
      const res = await act("shareholder_update.approved", { quarter: view.quarter }, { actor: "jerome", entityType: "shareholder_update", entityId: view.quarter });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  const running = flow.status === "running";

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        {d ? (
          <Paper>
            <p className="text-[12px] font-medium leading-[1.5] text-paper-ink/60" data-testid="draft-meta">
              Draft {d.n} · investor relations agent · {view.quarter} shareholder update · Built from {d.k} approved records.
            </p>
            <h2 className="mt-4 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">{d.title}</h2>
            <div className="mt-6 whitespace-pre-line text-[16px]" data-testid="draft-body">
              {d.segments.map((seg) =>
                seg.kind === "text" ? (
                  editing ? (
                    <span key={seg.index} className="my-2 block whitespace-normal">
                      <label className="sr-only" htmlFor={`seg-${seg.index}`}>
                        Paragraph text {seg.index + 1}
                      </label>
                      <textarea
                        id={`seg-${seg.index}`}
                        value={drafts[seg.index] ?? seg.text}
                        rows={Math.max(2, Math.ceil((drafts[seg.index] ?? seg.text).length / 70))}
                        onChange={(e) => setDrafts((cur) => ({ ...cur, [seg.index]: e.target.value }))}
                        className="w-full rounded-item border border-paper-ink/30 bg-paper px-3 py-2 text-[15px] text-paper-ink"
                      />
                    </span>
                  ) : (
                    <span key={seg.index}>{seg.text}</span>
                  )
                ) : (
                  <RefText key={seg.index} seg={seg} />
                ),
              )}
            </div>
          </Paper>
        ) : (
          <Tile>
            <p className="text-[14px] text-ink-3">The draft will appear here once Captain has drafted it.</p>
          </Tile>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {locked ? (
            <Button variant="done" disabled>
              Approved · sent to shareholders (demo)
            </Button>
          ) : (
            <>
              {d && (
                <Button variant="primary" onClick={approve} disabled={pending || running || editing}>
                  Approve and send
                </Button>
              )}
              <Button variant="outline" onClick={redraft} disabled={running || pending || editing}>
                Redraft
              </Button>
              {d &&
                (editing ? (
                  <>
                    <Button variant="outline" onClick={save} disabled={pending}>
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={startEdit} disabled={running}>
                    Edit
                  </Button>
                ))}
            </>
          )}
          {flow.replaying && <Meta>Replaying a recent run</Meta>}
          {(error || flow.error) && (
            <span role="alert" className="text-[13px] text-amber">
              {error ?? flow.error}
            </span>
          )}
        </div>
        {running && (
          <ProgressSteps
            steps={
              flow.steps.length
                ? flow.steps.map((s) => ({ key: s.key, label: humanise(s.key), state: s.state, detail: s.detail }))
                : [{ key: "start", label: "Reading approved records", state: "running" }]
            }
          />
        )}
      </div>

      <aside className="flex flex-col gap-6">
        <Tile className="flex flex-col gap-3">
          <h3 className="h2">Before it goes</h3>
          <p className="text-[14px] text-ink-2">You approve the draft. Figures that aren&rsquo;t approved records yet are held back, not guessed.</p>
          {d && d.heldBack.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {d.heldBack.map((h, i) => (
                <li key={i} className="flex flex-col gap-0.5 border-t border-line-2 pt-2 text-[13px]">
                  <StatusDot tone="amber" label={`Held back: ${h.label}`} />
                  <span className="text-ink-3">{h.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Meta>Nothing is held back in this draft.</Meta>
          )}
        </Tile>
        <div className="flex flex-col gap-1.5 px-1">
          <h3 className="h2">Co-investors</h3>
          <p className="text-[13px] text-ink-2">Rypples OS records are not shared with co-investors. Founders choose what co-investors see from Bridge.</p>
        </div>
      </aside>
    </div>
  );
}
