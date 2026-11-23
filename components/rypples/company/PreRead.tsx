"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { act } from "@/lib/actions";
import { Button, Illustrative, SourceChip, buttonClass } from "@/components/ui";
import { CopyButton, Modal, useCaptain } from "@/components/ui/client";
import { IconCheck, IconSend } from "@/components/ui/icons";
import type { SrcRef } from "@/lib/data/projections/company";

export type PreReadProps = {
  binding: { label: string; statement: string; detail: string | null; sources: SrcRef[] } | null;
  questions: string[];
  decision: { id: string; question: string; line: string; open: boolean; outcome: string | null } | null;
  layers: { id: string; name: string; who: string; status: string; provenance: string }[];
  layersSource: SrcRef | null;
};

export function PreRead({ binding, questions, decision, layers, layersSource }: PreReadProps) {
  const { open } = useCaptain();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [model, setModel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discuss = () => {
    if (!decision) return;
    setError(null);
    start(async () => {
      const r = await act("decision.resolved", { decision_id: decision.id, outcome: "board_agenda" }, { actor: "jerome", entityType: "decision", entityId: decision.id });
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col divide-y divide-line-2">
      {binding && (
        <div className="flex flex-col gap-2 pb-6">
          <span className="eyebrow">Binding constraint · {binding.label}</span>
          <p className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{binding.statement}</p>
          {binding.detail && <p className="max-w-[760px] text-[14px] text-ink-2">{binding.detail}</p>}
          {binding.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {binding.sources.map((s) => (
                <SourceChip key={s.id} href={s.href} label={s.label} />
              ))}
            </div>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-3 py-6">
          <h3 className="h2">Ask, don&rsquo;t tell</h3>
          <ol className="flex flex-col">
            {questions.map((q, i) => (
              <li key={i} className="flex flex-col gap-2 border-b border-line-2 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="max-w-[640px] text-[14px] text-ink">
                  <span className="mr-2 text-ink-3">{i + 1}.</span>
                  {q}
                </p>
                <div className="flex shrink-0 items-center gap-5">
                  <CopyButton text={q} label="Copy" />
                  <button
                    type="button"
                    onClick={() => open(`Help me prepare this question for the board: ${q}`)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-lime hover:text-lime-bright"
                  >
                    <IconSend size={14} />
                    Send to Captain
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {decision && (
        <div className="flex flex-col gap-3 pt-6">
          <h3 className="h2">{decision.open ? "Decision waiting for you" : "Decision recorded"}</h3>
          <p className="text-[15px] font-medium text-ink">{decision.question}</p>
          <p className="text-[13px] text-ink-3">{decision.line}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {decision.open ? (
              <Button onClick={discuss} disabled={pending}>
                {pending ? "Saving" : "Discuss at the board"}
              </Button>
            ) : (
              <span className={buttonClass("done")}>
                <IconCheck size={14} />
                {decision.outcome === "board_agenda" ? "On the board agenda" : "Decision recorded"}
              </span>
            )}
            {layers.length > 0 && <Button onClick={() => setModel(true)}>Open the model</Button>}
          </div>
          {error && <p role="alert" className="text-[13px] text-amber">{error}</p>}
        </div>
      )}

      <Modal open={model} onClose={() => setModel(false)} title="Plant SPV #1: capital stack" width={620}>
        <div className="flex flex-col gap-4 pb-4">
          <p className="text-[13px] text-ink-3">Most junior layer at the top. The first-loss layer is the question in front of the board.</p>
          <ol className="flex flex-col">
            {layers.map((l, i) => (
              <li key={l.id} className="grid gap-1 border-t border-line-2 py-3 sm:grid-cols-[28px_1fr_auto] sm:items-baseline sm:gap-4">
                <span className="text-[12px] text-ink-3">{i + 1}</span>
                <span className="flex flex-col">
                  <span className="text-[14px] font-medium text-ink">{l.name}</span>
                  <span className="text-[13px] text-ink-3">{l.who}</span>
                </span>
                <span className="text-[13px] text-ink-2">{l.provenance === "illustrative" ? <Illustrative>{l.status}</Illustrative> : l.status}</span>
              </li>
            ))}
          </ol>
          <p className="meta">
            Layer statuses are illustrative and are not Rypples commitments.
            {layersSource && (
              <>
                {" "}The SPV structure comes from <SourceChip href={layersSource.href} label={layersSource.label} />.
              </>
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}
