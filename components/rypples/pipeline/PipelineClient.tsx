"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { act } from "@/lib/actions";
import { useFlow } from "@/lib/ai/useFlow";
import type { DayOneResult } from "@/lib/ai/types";
import { Button, EmptyState, Illustrative, Pill, ScoreBar, Section, Tile, GeneratedLabel } from "@/components/ui";
import { Modal, Sheet } from "@/components/ui/client";
import {
  STAGES,
  stageLabel,
  summaryFromResult,
  type DealView,
  type PipelineView,
  type StageId,
} from "@/lib/data/projections/pipeline";
import { DayOneProgress, DayOneResultPanel } from "./DayOnePanel";

const ORDER: StageId[] = ["sourced", "first_meeting", "diligence", "ic", "led"];
const ADVANCE_LABEL: Record<string, string> = {
  sourced: "Book first meeting",
  first_meeting: "Request data room",
  diligence: "Send to IC",
  ic: "Mark as led",
};

type Drag = { id: string; x: number; y: number; over: StageId | null };

export function PipelineClient({
  view,
  initialDealId,
  closeDate,
}: {
  view: PipelineView;
  initialDealId: string | null;
  closeDate: string;
}) {
  const router = useRouter();
  const flow = useFlow<DayOneResult>("day-one");
  const [selectedId, setSelectedId] = useState<string | null>(initialDealId);
  const [overlay, setOverlay] = useState<Record<string, StageId>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dataRoomOpen, setDataRoomOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [runDealId, setRunDealId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; active: boolean } | null>(null);

  useEffect(() => setOverlay({}), [view.deals]);

  const deals = useMemo(() => view.deals.map((d) => ({ ...d, stage: overlay[d.id] ?? d.stage })), [view.deals, overlay]);
  const byId = useCallback((id: string | null) => deals.find((d) => d.id === id) ?? null, [deals]);
  const selected = byId(selectedId);
  const [mobileStage, setMobileStage] = useState<StageId>(selected?.stage ?? "sourced");

  const select = (id: string) => {
    setSelectedId(id);
    setNotice(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("deal", id);
      window.history.replaceState(null, "", u.toString());
    } catch {
      /* URL sync is best effort */
    }
  };

  const commitMove = async (d: DealView, to: StageId) => {
    const from = d.stage;
    setOverlay((o) => ({ ...o, [d.id]: to }));
    const res = await act("deal.moved", { deal_id: d.id, from, to }, { actor: "jerome", entityType: "deal", entityId: d.id });
    if (!res.ok) {
      setOverlay((o) => {
        const n = { ...o };
        delete n[d.id];
        return n;
      });
      setNotice("Couldn't move the deal. Nothing was saved.");
      return;
    }
    router.refresh();
  };

  /** The one move rule, used by the stage CTA, the Mark as led button and drag and drop. */
  const requestMove = (d: DealView, to: StageId) => {
    if (to === d.stage) return;
    setNotice(null);
    if (to === "led") {
      if (d.stage !== "ic") {
        setNotice(`Only deals that have been through IC can be led. Send ${d.codename} to IC first.`);
        return;
      }
      if (!d.diligence_complete) {
        setNotice("Day-one plan needs a completed diligence diagnostic.");
        return;
      }
      select(d.id);
      setConfirmFor(d.id);
      return;
    }
    if (d.stage === "led") {
      setNotice(`${d.codename} is already led.`);
      return;
    }
    void commitMove(d, to);
  };

  const startDayOne = async (id: string | null) => {
    if (!id) return;
    setConfirmFor(null);
    setRunDealId(id);
    const r = await flow.start({ dealId: id });
    if (r?.data) {
      setOverlay((o) => ({ ...o, [id]: "led" }));
      router.refresh();
    }
  };

  // ── drag with pointer events ──
  // Mouse and pen drag the whole card; touch drags from the grip only, so the page still scrolls.
  // The card captures the pointer on press, so a quick flick still counts. A press that doesn't
  // move is a click: it selects the deal (the button's own onClick covers the keyboard).
  const stageAt = (x: number, y: number): StageId | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-stage]");
    const v = el?.getAttribute("data-stage");
    return ORDER.includes(v as StageId) ? (v as StageId) : null;
  };
  const onDown = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && !(e.target as Element).closest("[data-grip]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, active: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.active && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.active = true;
    setDrag({ id: d.id, x: e.clientX, y: e.clientY, over: stageAt(e.clientX, e.clientY) });
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const to = d.active || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= 5 ? stageAt(e.clientX, e.clientY) : null;
    setDrag(null);
    const deal = byId(d.id);
    if (!deal) return;
    if (to) requestMove(deal, to);
    else if (!d.active) select(deal.id);
  };
  const onCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const counts = Object.fromEntries(STAGES.map((s) => [s.id, deals.filter((d) => d.stage === s.id).length])) as Record<StageId, number>;
  const dragging = drag ? byId(drag.id) : null;
  const confirmDeal = byId(confirmFor);

  return (
    <div className="flex flex-col gap-8">
      <Section
        id="board"
        title="Board"
        aside={
          <button
            type="button"
            className="text-link text-[13px]"
            aria-expanded={signalsOpen}
            aria-controls="signals"
            onClick={() => setSignalsOpen((v) => !v)}
          >
            Flagged this week ({view.signals.length})
          </button>
        }
      >
        {signalsOpen && (
          <Tile className="py-2" >
            <ul id="signals" className="flex flex-col divide-y divide-line-2">
              {view.signals.map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <span className="text-[14px] text-ink">
                    {x.codename} <span className="meta">· {x.vertical} · {x.region}</span>
                  </span>
                  <span className="text-[13px] text-ink-2">
                    <Illustrative>{x.signal}</Illustrative>
                  </span>
                </li>
              ))}
            </ul>
          </Tile>
        )}

        {/* Phone: stage selector */}
        <div className="flex flex-wrap gap-2 sm:hidden" role="group" aria-label="Stage">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={mobileStage === s.id}
              onClick={() => setMobileStage(s.id)}
              className={clsx(
                "rounded-btn border px-3 py-1.5 text-[13px] font-medium",
                mobileStage === s.id ? "border-lime-30 bg-lime-10 text-lime" : "border-line-2 bg-surface text-ink-2",
              )}
            >
              {s.label} ({counts[s.id]})
            </button>
          ))}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {notice ?? ""}
        </p>
        {notice && <p className="text-[13px] text-amber">{notice}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((s) => {
            const list = deals.filter((d) => d.stage === s.id);
            return (
              <div
                key={s.id}
                data-stage={s.id}
                aria-label={`${s.label}, ${list.length} deals`}
                role="group"
                className={clsx(
                  "min-h-[140px] flex-col gap-3 rounded-tile border bg-surface p-3",
                  mobileStage === s.id ? "flex" : "max-sm:hidden sm:flex",
                  drag?.over === s.id ? "border-lime-30 bg-lime-10" : "border-line-2",
                )}
              >
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <h3 className="text-[13px] font-semibold text-ink">{s.label}</h3>
                  <span className="meta">{list.length}</span>
                </div>
                {list.length === 0 && (
                  <p className="px-1 text-[13px] text-ink-3">
                    {s.id === "led" ? "Anchor rounds led this quarter" : "No deals here"}
                  </p>
                )}
                {list.map((d) => (
                  <div
                    key={d.id}
                    onPointerDown={(e) => onDown(e, d.id)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onCancel}
                    className={clsx(
                      "flex select-none items-stretch rounded-item border bg-panel",
                      selectedId === d.id ? "border-lime-30" : "border-line-2",
                      drag?.id === d.id && "opacity-40",
                    )}
                  >
                    <span
                      data-grip
                      title="Drag to move"
                      aria-hidden="true"
                      className="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-3 max-sm:hidden"
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                        <circle cx="2" cy="3" r="1.3" /><circle cx="8" cy="3" r="1.3" />
                        <circle cx="2" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" />
                        <circle cx="2" cy="13" r="1.3" /><circle cx="8" cy="13" r="1.3" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      aria-pressed={selectedId === d.id}
                      onClick={() => select(d.id)}
                      className="flex flex-1 flex-col gap-1 py-3 pr-3 text-left max-sm:pl-3 sm:cursor-grab"
                    >
                      <span className="text-[14px] font-semibold text-ink">{d.codename}</span>
                      <span className="meta">
                        {d.vertical} · {d.region}
                      </span>
                      <span className="text-[13px] text-ink-2">{d.note}</span>
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="detail" title={selected ? selected.codename : "Deal detail"}>
        {!selected ? (
          <Tile>
            <EmptyState>Select a deal to see its data room, proposed constraint and day-one plan.</EmptyState>
          </Tile>
        ) : (
          <DealPanel
            key={selected.id}
            deal={selected}
            view={view}
            flow={flow}
            runDealId={runDealId}
            onAdvance={() => {
              const i = ORDER.indexOf(selected.stage);
              if (i >= 0 && i < ORDER.length - 1) requestMove(selected, ORDER[i + 1]);
            }}
            onDataRoom={() => setDataRoomOpen(true)}
            onDiagnostic={() => setDiagOpen(true)}
            onRetry={() => startDayOne(selected.id)}
          />
        )}
      </Section>

      {drag && dragging && (
        <div
          className="pointer-events-none fixed z-50 rounded-item border border-lime-30 bg-panel px-3 py-2 text-[13px] font-semibold text-ink"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {dragging.codename}
        </div>
      )}

      {selected && (
        <Sheet open={dataRoomOpen} onClose={() => setDataRoomOpen(false)} title={`${selected.codename} data room`} meta="Demo connection">
          {selected.data_room.length === 0 ? (
            <EmptyState>No files received yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-line-2">
              {selected.data_room.map((f) => (
                <li key={f.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <span className="text-[14px] text-ink">{f.name}</span>
                  <span className="meta">
                    {f.type} · Modified {f.modified}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {selected?.diligence && (
        <Sheet
          open={diagOpen}
          onClose={() => setDiagOpen(false)}
          title={`${selected.codename} diligence`}
          meta={<Illustrative>Illustrative diagnostic</Illustrative>}
          width={640}
        >
          <div className="flex flex-col gap-6">
            <ul className="flex flex-col divide-y divide-line-2">
              {selected.diligence.rows.map((r) => (
                <li key={r.domain_id} className="flex flex-col gap-1.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold text-ink">{r.label}</span>
                    <Illustrative>
                      <ScoreBar score={r.score} label={r.label} binding={r.label === selected.constraint_domain_label} />
                    </Illustrative>
                  </div>
                  {r.score == null && !r.finding ? (
                    <p className="text-[13px] text-ink-3">Evidence gap</p>
                  ) : (
                    r.finding && <p className="text-[13px] text-ink-2">{r.finding}</p>
                  )}
                  {r.evidence_titles.length > 0 && <p className="meta">Evidence: {r.evidence_titles.join(", ")}</p>}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <span className="eyebrow">Evidence items</span>
              <ul className="flex flex-col gap-3">
                {selected.diligence.evidence.map((e) => (
                  <li key={e.id} className="flex flex-col">
                    <span className="text-[14px] text-ink">{e.claim}</span>
                    <span className="text-[13px] text-ink-2">{e.cited_text}</span>
                    <span className="meta">{e.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Sheet>
      )}

      <Modal
        open={!!confirmDeal}
        onClose={() => setConfirmFor(null)}
        title={`Rypples leads ${confirmDeal?.codename ?? ""}'s round`}
        footer={
          <>
            <Button onClick={() => setConfirmFor(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => startDayOne(confirmFor)}>
              Start day one
            </Button>
          </>
        }
      >
        <dl className="flex flex-col gap-3 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Round close date</dt>
            <dd className="text-ink"><Illustrative>{closeDate}</Illustrative></dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Board seat</dt>
            <dd className="text-ink"><Illustrative>Yes</Illustrative></dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Allocation</dt>
            <dd className="text-ink"><Illustrative>3 programs / 400 hours</Illustrative></dd>
          </div>
        </dl>
        <p className="meta mt-4">Day one turns the diligence diagnostic into a plan, an allocation and a Rypples Engine workspace for the founder.</p>
      </Modal>
    </div>
  );
}

function DealPanel({
  deal,
  view,
  flow,
  runDealId,
  onAdvance,
  onDataRoom,
  onDiagnostic,
  onRetry,
}: {
  deal: DealView;
  view: PipelineView;
  flow: ReturnType<typeof useFlow<DayOneResult>>;
  runDealId: string | null;
  onAdvance: () => void;
  onDataRoom: () => void;
  onDiagnostic: () => void;
  onRetry: () => void;
}) {
  const mine = runDealId === deal.id;
  const failed = mine && (flow.status === "error" || (flow.status === "done" && !flow.result?.data));
  const running = mine && flow.status === "running";
  const streamed = mine && flow.result?.data ? summaryFromResult(flow.result.data, deal.codename, view.domainLabels, view.recruitingNote) : null;
  const stored = view.led && view.led.dealId === deal.id ? view.led : null;
  const summary = streamed ?? stored;
  const advance = ADVANCE_LABEL[deal.stage];

  return (
    <Tile className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{stageLabel(deal.stage)}</Pill>
          <Pill grey>{deal.vertical}</Pill>
          <Pill grey>{deal.region}</Pill>
        </div>
        <p className="text-[15px] text-ink">{deal.what}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onDataRoom}>Open data room</Button>
          {advance && !running && !(summary && deal.stage === "led") && (
            <Button onClick={onAdvance}>{advance}</Button>
          )}
          {deal.diligence && <Button onClick={onDiagnostic}>View diagnostic</Button>}
        </div>
      </div>

      {(running || failed || summary) && (
        <div className="border-t border-line-2 pt-5">
          {running && <DayOneProgress steps={flow.steps} replaying={flow.replaying} />}
          {failed && (
            <div className="flex flex-col items-start gap-3" aria-live="polite">
              <p className="text-[14px] text-amber">Captain couldn&apos;t finish this run. Nothing was saved.</p>
              <Button onClick={onRetry}>Try again</Button>
            </div>
          )}
          {!running && !failed && summary && (
            <>
              {streamed && flow.replaying && <p className="meta mb-3">Replaying a recent run</p>}
              <DayOneResultPanel r={summary} />
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 border-t border-line-2 pt-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Proposed binding constraint</span>
          <p className="text-[14px] text-ink">
            {deal.constraint_domain_label ? `${deal.constraint_domain_label}: ` : ""}
            {deal.proposed_constraint}
          </p>
          <p className="text-[13px] text-ink-2">{deal.why}</p>
          <p className="meta">From {deal.evidence_count} items in the data room</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Day-one plan, if Rypples leads</span>
          <ol className="flex flex-col gap-1.5 text-[14px] text-ink">
            {deal.plan_drafts.map((p, i) => (
              <li key={p}>
                {i + 1}. {p}
              </li>
            ))}
          </ol>
          <GeneratedLabel />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line-2 pt-5">
        <span className="eyebrow">Partners and Playbook</span>
        <p className="text-[14px] text-ink-2">{deal.partner_note}</p>
        <p className="text-[14px] text-ink-2">{deal.lesson_note}</p>
      </div>
    </Tile>
  );
}
