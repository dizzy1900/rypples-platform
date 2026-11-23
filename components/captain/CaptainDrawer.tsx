"use client";
/**
 * Captain drawer (S10, docs/07-ai.md §4 F3). Bootstraps from GET /api/ai/captain, asks through the
 * "captain" flow, and records every approval through act(). Agents draft, people decide.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, RecordChip, SourceChip, StatusDot, TextLink } from "@/components/ui";
import { DrawerHeader } from "@/components/ui/client";
import { IconSend, IconWheel } from "@/components/ui/icons";
import { act } from "@/lib/actions";
import type { CaptainAnswer, CaptainBootstrap, CaptainProposal, CaptainScopeInput } from "@/lib/ai/types";
import { useFlow } from "@/lib/ai/useFlow";
import { CaptainMarkdown, stripMarkers, toRelative } from "./Markdown";

export type CaptainScope = { kind: "os" } | { kind: "bridge"; slug: string; companyName: string };

type ProposalStatus = "proposed" | "approved" | "rejected";
type Local = { key: string; question: string; answer: CaptainAnswer };

const MAX_INPUT = 1000;

const toInput = (s: CaptainScope): CaptainScopeInput => (s.kind === "os" ? { kind: "os" } : { kind: "bridge", slug: s.slug });
const bootstrapUrl = (s: CaptainScope) =>
  s.kind === "os" ? "/api/ai/captain?scope=os" : `/api/ai/captain?scope=bridge&slug=${encodeURIComponent(s.slug)}`;

export function CaptainDrawer({ scope, onClose, prefill }: { scope: CaptainScope; onClose: () => void; prefill?: string }) {
  const [boot, setBoot] = useState<CaptainBootstrap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [local, setLocal] = useState<Local[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [overrides, setOverrides] = useState<Record<string, ProposalStatus>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const flow = useFlow<CaptainAnswer>("captain");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scopeKey = scope.kind === "os" ? "os" : `bridge:${scope.slug}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(bootstrapUrl(scope), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setBoot((await res.json()) as CaptainBootstrap);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
    // scopeKey captures everything bootstrapUrl reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (prefill === undefined) return;
    setInput(prefill.slice(0, MAX_INPUT));
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [prefill]);

  const running = flow.status === "running";

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [local.length, pending, boot?.thread.length]);

  const ask = useCallback(
    async (raw: string) => {
      const message = raw.trim().slice(0, MAX_INPUT);
      if (!message || running) return;
      setPending(message);
      setInput("");
      const r = await flow.start({ message, scope: toInput(scope) });
      if (r?.data) {
        const answer = r.data;
        setLocal((xs) => [...xs, { key: answer.message_id || r.id, question: message, answer }]);
        setPending(null);
        void load();
      } else {
        // keep the question visible with the error so it can be retried
        setInput(message);
        setPending(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [running, scopeKey, flow.start, load],
  );

  const status = (id: string): ProposalStatus => overrides[id] ?? boot?.proposals[id] ?? "proposed";

  const decide = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      if (!boot) return;
      setActionError(null);
      setOverrides((o) => ({ ...o, [id]: decision }));
      const r = await act(decision === "approved" ? "proposal.approved" : "proposal.rejected", { proposal_id: id }, {
        actor: boot.actor,
        entityType: "proposal",
        entityId: id,
      });
      if (!r.ok) {
        setOverrides((o) => {
          const n = { ...o };
          delete n[id];
          return n;
        });
        setActionError("That decision was not saved. Try again.");
        return;
      }
      void load();
    },
    [boot, load],
  );

  const newConversation = useCallback(async () => {
    setClearing(true);
    try {
      await fetch("/api/ai/captain", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: toInput(scope) }),
      });
    } finally {
      setLocal([]);
      setPending(null);
      flow.reset();
      await load();
      setClearing(false);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, load, flow.reset]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(input);
    }
  };

  const meta =
    scope.kind === "os"
      ? "Works across Rypples OS, Bridge and your connected tools"
      : `Answers from ${scope.companyName}'s records in Bridge`;

  // Exchanges persisted in the thread are not repeated from local state.
  const threadIds = new Set((boot?.thread ?? []).flatMap((m) => [m.id, m.answer?.message_id].filter(Boolean) as string[]));
  const localOnly = local.filter((x) => !threadIds.has(x.answer.message_id));
  const hasConversation = !!boot && (boot.thread.length > 0 || localOnly.length > 0 || !!pending);
  const showSeeded = !!boot?.seeded;

  return (
    <>
      <DrawerHeader title="Captain" meta={meta} onClose={onClose} icon={<IconWheel />} />

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {!boot && !loadError && (
          <p className="meta" role="status">
            Loading Captain…
          </p>
        )}
        {!boot && loadError && (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p className="text-[14px] text-ink-2">Captain could not load just now.</p>
            <Button variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        )}

        {boot && (
          <div className="flex flex-col gap-8">
            {scope.kind === "os" && boot.overnight.length > 0 && (
              <section aria-labelledby="captain-overnight" className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 id="captain-overnight" className="eyebrow">
                    Overnight
                  </h3>
                  <p className="meta">Everything here waits for a person</p>
                </div>
                <ul className="flex flex-col divide-y divide-line-2 rounded-item border border-line-2">
                  {boot.overnight.map((item) => {
                    const st = overrides[item.id] ?? boot.proposals[item.id] ?? item.status;
                    const tone = st === "approved" ? "lime" : st === "proposed" ? "amber" : "neutral";
                    const rel = toRelative(item.route) ?? item.route;
                    return (
                      <li key={item.id} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <StatusDot tone={tone} label={<span className="text-ink">{item.what}</span>} />
                          <span className="meta shrink-0">{item.at_label}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-[15px]">
                          <span className="meta">{st === "approved" ? "Approved" : st === "rejected" ? "Dismissed" : item.state}</span>
                          {item.action === "approve" && st === "proposed" && (
                            <Button variant="outline" onClick={() => void decide(item.id, "approved")}>
                              Approve
                            </Button>
                          )}
                          {item.action === "review" ? (
                            <TextLink href={rel}>Review</TextLink>
                          ) : (
                            <TextLink href={rel}>Open</TextLink>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {scope.kind === "bridge" && boot.since_last.length > 0 && (
              <section aria-labelledby="captain-since" className="flex flex-col gap-3">
                <h3 id="captain-since" className="eyebrow">
                  Since you were last here
                </h3>
                <ul className="flex flex-col gap-2">
                  {boot.since_last.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <StatusDot tone={item.tone} label={item.what} />
                      <TextLink href={toRelative(item.route) ?? item.route}>Open</TextLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {actionError && (
              <p className="text-[13px] text-ink-2" role="alert">
                {actionError}
              </p>
            )}

            <section aria-label="Conversation" className="flex flex-col gap-6">
              {(hasConversation || showSeeded) && (
                <div className="flex justify-end">
                  <Button variant="text" onClick={() => void newConversation()} disabled={clearing || running}>
                    {clearing ? "Starting…" : "New conversation"}
                  </Button>
                </div>
              )}

              {boot.seeded && (
                <div className="flex flex-col gap-3">
                  <p className="eyebrow">{boot.seeded.label || "From this morning"}</p>
                  <UserBubble text={boot.seeded.answer.question} />
                  <Answer answer={boot.seeded.answer} status={status} decide={decide} ask={ask} disabled={running} />
                </div>
              )}

              {boot.thread.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} text={m.text} />
                ) : m.answer ? (
                  <Answer key={m.id} answer={m.answer} status={status} decide={decide} ask={ask} disabled={running} />
                ) : (
                  <CaptainMarkdown key={m.id} text={m.text} />
                ),
              )}

              {localOnly.map((x) => (
                <div key={x.key} className="flex flex-col gap-6">
                  <UserBubble text={x.question} />
                  <Answer answer={x.answer} status={status} decide={decide} ask={ask} disabled={running} />
                </div>
              ))}

              {pending && (
                <div className="flex flex-col gap-6">
                  <UserBubble text={pending} />
                  <div aria-live="polite" aria-busy={running} className="flex flex-col gap-2">
                    {flow.replaying && <p className="meta">Replaying a recent run</p>}
                    {flow.text ? (
                      <CaptainMarkdown text={stripMarkers(flow.text)} />
                    ) : (
                      <p className="meta">Reading records…</p>
                    )}
                  </div>
                </div>
              )}

              {!running && flow.error && (
                <p className="text-[13px] text-ink-2" role="alert">
                  Captain could not answer that just now. Your question is back in the box below.
                </p>
              )}

              {!hasConversation && !showSeeded && boot.prompts.length > 0 && (
                <PromptChips prompts={boot.prompts} ask={ask} disabled={running} label="Try asking" />
              )}
            </section>

            {boot.connected.length > 0 && (
              <section aria-labelledby="captain-connected" className="flex flex-col gap-3 border-t border-line-2 pt-5">
                <h3 id="captain-connected" className="eyebrow">
                  Connected
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {boot.connected.map((c) => (
                    <li key={c.id}>
                      <span
                        tabIndex={c.demo ? 0 : undefined}
                        className="group inline-flex items-center gap-2 rounded-btn border border-line-2 px-2 py-[2px] text-[12px] text-ink-2 outline-none focus-visible:ring-1 focus-visible:ring-lime"
                      >
                        <StatusDot tone={c.status === "connected" ? "lime" : "neutral"} label={c.name} className="text-[12px]" />
                        {c.demo && <span className="meta hidden group-hover:inline group-focus:inline">demo</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <TextLink href="/connect">Use Rypples from your own Claude →</TextLink>
              </section>
            )}
          </div>
        )}
      </div>

      <form
        className="border-t border-line-2 px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label htmlFor="captain-input" className="sr-only">
          Ask Captain
        </label>
        <div className="flex items-end gap-2 rounded-item border border-line-2 bg-surface px-3 py-2 focus-within:border-lime-30">
          <textarea
            id="captain-input"
            ref={inputRef}
            value={input}
            maxLength={MAX_INPUT}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={running || !boot}
            placeholder={boot?.placeholder ?? "Ask Captain"}
            className="min-h-[44px] flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={running || !boot || !input.trim()}
            className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-btn text-lime hover:bg-lime-30 disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            <IconSend size={16} />
          </button>
        </div>
        <p className="meta mt-2">Enter to send, Shift and Enter for a new line</p>
      </form>
    </>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="well max-w-[85%] whitespace-pre-wrap text-[14px] leading-[1.5] text-ink">{text}</p>
    </div>
  );
}

function PromptChips({
  prompts,
  ask,
  disabled,
  label,
}: {
  prompts: string[];
  ask: (q: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="meta">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => ask(p)}
              className="rounded-btn border border-line-2 px-3 py-1 text-left text-[13px] text-ink-2 hover:border-lime-30 hover:text-ink disabled:opacity-60"
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Answer({
  answer,
  status,
  decide,
  ask,
  disabled,
}: {
  answer: CaptainAnswer;
  status: (id: string) => ProposalStatus;
  decide: (id: string, d: "approved" | "rejected") => void;
  ask: (q: string) => void;
  disabled: boolean;
}) {
  const chips = answer.refs
    .map((r) => {
      const rel = r.href ? toRelative(r.href) : null;
      if (rel) return <RecordChip key={`${r.type}/${r.id}`} href={rel} label={r.label} />;
      const ext = r.url ?? r.href;
      if (ext && /^https?:\/\//.test(ext)) return <SourceChip key={`${r.type}/${r.id}`} href={ext} label={r.label} />;
      return null;
    })
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {answer.from_cache && !answer.paused && <p className="meta">Replaying a recent run</p>}
      {answer.text && <CaptainMarkdown text={answer.text} untraced={answer.untraced} />}
      {answer.paused && (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-ink-2">{answer.paused.message}</p>
          {answer.paused.prompts.length > 0 && <PromptChips prompts={answer.paused.prompts} ask={ask} disabled={disabled} label="You can ask" />}
        </div>
      )}
      {chips.length > 0 && <div className="flex flex-wrap gap-2">{chips}</div>}
      {answer.next_steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Suggested next steps</p>
          <ul className="flex flex-col divide-y divide-line-2 rounded-item border border-line-2">
            {answer.next_steps.map((p) => (
              <ProposalRow key={p.proposal_id} p={p} st={status(p.proposal_id)} decide={decide} />
            ))}
          </ul>
        </div>
      )}
      {answer.records_read > 0 && (
        <p className="meta">
          Read {answer.records_read} {answer.records_read === 1 ? "record" : "records"} through the Rypples tool registry.
        </p>
      )}
    </div>
  );
}

function ProposalRow({ p, st, decide }: { p: CaptainProposal; st: ProposalStatus; decide: (id: string, d: "approved" | "rejected") => void }) {
  const target = p.target ? (toRelative(p.target) ?? null) : null;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-medium text-ink">{p.title}</p>
        {p.detail && <p className="text-[13px] text-ink-2">{p.detail}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {st === "proposed" ? (
          <>
            <StatusDot tone="amber" label="needs your approval" />
            <Button variant="outline" onClick={() => decide(p.proposal_id, "approved")}>
              Approve
            </Button>
            <Button variant="text" onClick={() => decide(p.proposal_id, "rejected")}>
              Dismiss
            </Button>
          </>
        ) : (
          <StatusDot tone={st === "approved" ? "lime" : "neutral"} label={st === "approved" ? "Approved" : "Dismissed"} />
        )}
        {target && <TextLink href={target}>Open</TextLink>}
      </div>
    </li>
  );
}
