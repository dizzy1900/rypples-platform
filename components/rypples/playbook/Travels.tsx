"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { act } from "@/lib/actions";
import { useFlow } from "@/lib/ai/useFlow";
import type { LessonMatchResult } from "@/lib/ai/types";
import { Button, GeneratedLabel, Illustrative, Meta, StatusDot, Tile } from "@/components/ui";
import { ProgressSteps } from "@/components/ui/client";
import { IconSend } from "@/components/ui/icons";
import { canRipple, RippleCanvas } from "@/components/rypples/RippleCanvas";
import type { PlaybookView } from "@/lib/data/projections/playbook";

const CROSS_MS = 1200; // wave crossing time over the panel diagonal
const MOUNT_MS = 1600; // canvas lifetime
const STAGGER_MS = 120; // reduced-motion / no-WebGL path

const humanise = (k: string) => k.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Travels({
  travels,
  names,
  decisionOpen,
}: {
  travels: PlaybookView["travels"];
  names: Record<string, string>;
  decisionOpen: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState<Set<string>>(new Set());
  const [ripple, setRipple] = useState<{ key: number; x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const flow = useFlow<LessonMatchResult>("lesson-match");

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (mountTimer.current) clearTimeout(mountTimer.current);
    },
    [],
  );

  const release = useCallback((id: string, ms: number) => {
    timers.current.push(
      setTimeout(() => {
        setHolding((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        });
      }, ms),
    );
  }, []);

  const send = async (row: PlaybookView["travels"]["rows"][number], btn: HTMLButtonElement) => {
    setError(null);
    const wasFirst = !travels.anySent;
    const useCanvas = !reduce && canRipple();
    setHolding((h) => new Set(h).add(row.companyId));

    if (useCanvas && panelRef.current) {
      const panel = panelRef.current.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const x = b.left + b.width / 2 - panel.left;
      const y = b.top + b.height / 2 - panel.top;
      const dot = dotRefs.current[row.companyId]?.getBoundingClientRect();
      const diag = Math.hypot(panel.width, panel.height) || 1;
      const dist = dot ? Math.hypot(dot.left + dot.width / 2 - panel.left - x, dot.top + dot.height / 2 - panel.top - y) : 0;
      release(row.companyId, Math.min(CROSS_MS, (dist / diag) * CROSS_MS));
      setRipple({ key: Date.now(), x, y });
      if (mountTimer.current) clearTimeout(mountTimer.current);
      mountTimer.current = setTimeout(() => setRipple(null), MOUNT_MS);
    } else {
      const order = travels.rows.filter((r) => !r.sent).findIndex((r) => r.companyId === row.companyId);
      release(row.companyId, Math.max(0, order) * STAGGER_MS);
    }

    const res = await act("lesson.sent", { lesson_id: travels.lessonId, company_id: row.companyId }, { actor: "jerome", entityType: "lesson", entityId: travels.lessonId });
    if (!res.ok) {
      setError(res.error);
      setHolding((h) => {
        const n = new Set(h);
        n.delete(row.companyId);
        return n;
      });
      return;
    }
    if (wasFirst && decisionOpen) {
      await act("decision.resolved", { decision_id: "dec-wsense-lesson", outcome: "sent" }, { actor: "jerome", entityType: "decision", entityId: "dec-wsense-lesson" });
    }
    router.refresh();
  };

  const proposed = flow.result?.data ?? null;
  const useMatches = async () => {
    if (!proposed) return;
    setApplying(true);
    const res = await act(
      "lesson.matches_replaced",
      { lesson_id: travels.lessonId, matches: proposed.matches, run_id: flow.result?.id ?? null },
      { actor: "jerome", entityType: "lesson", entityId: travels.lessonId },
    );
    setApplying(false);
    if (!res.ok) return setError(res.error);
    flow.reset();
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={panelRef} className="relative overflow-hidden rounded-tile">
        <Tile className="flex flex-col gap-2 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3 pb-2">
            <p className="font-display text-[22px] tracking-[-0.02em] text-ink" data-testid="match-count">
              {travels.matched} of {travels.eligible} matched
            </p>
            <Meta>Active public companies, excluding the company the lesson came from and exits.</Meta>
          </div>
          <ul>
            {travels.rows.map((r) => {
              const sent = r.sent && !holding.has(r.companyId);
              const sending = holding.has(r.companyId);
              return (
                <li
                  key={r.companyId}
                  data-testid={`travel-${r.companyId}`}
                  className="grid gap-3 border-t border-line-2 py-4 sm:grid-cols-[170px_1fr_auto] sm:items-start sm:gap-6"
                >
                  <div className="flex flex-col gap-1.5">
                    <Link href={`/os/companies/${r.slug}`} className="text-[15px] font-medium text-ink hover:text-lime">
                      {r.name}
                    </Link>
                    <span className="inline-flex items-center gap-2 text-[13px] text-ink-2" data-status={sent ? "sent" : "matched"}>
                      <span
                        ref={(el) => {
                          dotRefs.current[r.companyId] = el;
                        }}
                        aria-hidden
                        className={`inline-block h-[7px] w-[7px] rounded-full transition-colors duration-150 ${sent ? "bg-lime" : "bg-neutral-dot"}`}
                      />
                      {sent ? "Sent" : "Matched"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] text-ink-2">
                      {r.reasonProvenance === "illustrative" ? <Illustrative>{r.reason}</Illustrative> : r.reason}
                    </p>
                    {r.reasonProvenance === "generated" && <Meta>Generated by Captain · proposed match you approved</Meta>}
                    {r.verify && <Meta>Check: {r.verify}</Meta>}
                  </div>
                  <div>
                    {sent ? (
                      <Button variant="done" disabled>
                        Sent
                      </Button>
                    ) : !travels.approved ? (
                      <Button variant="outline" disabled>
                        Approve first
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={sending}
                        data-testid={`send-${r.companyId}`}
                        onClick={(e) => send(r, e.currentTarget)}
                      >
                        <IconSend size={14} />
                        {sending ? "Sending" : "Send to founder"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {error && (
            <p role="alert" className="pt-2 text-[13px] text-amber">
              {error}
            </p>
          )}
        </Tile>
        {ripple && <RippleCanvas key={ripple.key} origin={{ x: ripple.x, y: ripple.y }} />}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => flow.start({ lessonId: travels.lessonId })} disabled={flow.status === "running"}>
            Re-run matching
          </Button>
          {flow.replaying && <Meta>Replaying a recent run</Meta>}
        </div>

        {flow.status === "running" && (
          <ProgressSteps
            steps={
              flow.steps.length
                ? flow.steps.map((s) => ({ key: s.key, label: humanise(s.key), state: s.state, detail: s.detail }))
                : [{ key: "start", label: "Reading the lesson and the portfolio", state: "running" }]
            }
          />
        )}
        {flow.status === "error" && (
          <p role="alert" className="text-[13px] text-amber">
            {flow.error ?? "Captain couldn't finish this run. Nothing was saved."}
          </p>
        )}

        {proposed && (
          <Tile className="flex flex-col gap-4">
            <GeneratedLabel status="proposed" extra="replaces the current matches only when you use them" />
            <ul className="flex flex-col">
              {proposed.matches.map((m) => (
                <li key={m.company_id} className="grid gap-1 border-t border-line-2 py-3 first:border-t-0 sm:grid-cols-[170px_1fr] sm:gap-6">
                  <span className="text-[14px] font-medium text-ink">
                    {names[m.company_id] ?? m.company_id} <span className="meta">· {m.fit}</span>
                  </span>
                  <span className="text-[14px] text-ink-2">{m.reason}</span>
                </li>
              ))}
            </ul>
            {proposed.excluded.length > 0 && (
              <Meta>
                Left out: {proposed.excluded.map((x) => `${names[x.company_id] ?? x.company_id} (${x.reason})`).join("; ")}
              </Meta>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={useMatches} disabled={applying}>
                Use these matches
              </Button>
              <Button variant="outline" onClick={() => flow.reset()} disabled={applying}>
                Discard
              </Button>
            </div>
          </Tile>
        )}
        {flow.status === "done" && !proposed && !flow.error && (
          <StatusDot tone="neutral" label="Captain finished without a proposal. The current matches are unchanged." />
        )}
      </div>
    </div>
  );
}
