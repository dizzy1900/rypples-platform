"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Illustrative, SourceChip } from "@/components/ui";
import { Sheet } from "@/components/ui/client";
import { act } from "@/lib/actions";
import type { BridgeHome } from "@/lib/data/projections/bridge";

/** A lesson Jerome sent to this company: the play, the timeline, "Useful for us". */
export function LessonCard({ lesson, companyId }: { lesson: NonNullable<BridgeHome["lesson"]>; companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [useful, setUseful] = useState(lesson.useful);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const markUseful = () => {
    setUseful(true);
    setError(null);
    start(async () => {
      const res = await act("lesson.useful", { lesson_id: lesson.id, company_id: companyId }, { actor: `founder:${companyId}`, entityType: "lesson", entityId: lesson.id });
      if (!res.ok) {
        setUseful(false);
        setError("Could not save this. Try again.");
      } else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">{lesson.title}</p>
        <p className="meta">
          {lesson.domainLabel} · learned in {lesson.learnedIn}
        </p>
      </div>
      {lesson.why && (
        <p className="text-[14px]">
          <span className="font-medium text-ink">Why you. </span>
          {lesson.whyProvenance === "illustrative" ? <Illustrative>{lesson.why}</Illustrative> : lesson.why}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>Read the play</Button>
        {useful ? (
          <Button variant="done" disabled aria-live="polite">
            Marked useful
          </Button>
        ) : (
          <Button onClick={markUseful} disabled={pending}>
            Useful for us
          </Button>
        )}
        {error && (
          <span role="alert" className="text-[13px] text-amber">
            {error}
          </span>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="The play" meta={`${lesson.domainLabel} · learned in ${lesson.learnedIn}`}>
        <div className="flex flex-col gap-6">
          <p className="font-display text-[20px] leading-[1.25] tracking-[-0.02em] text-ink">{lesson.title}</p>
          <div className="flex flex-col gap-3">
            <h3 className="h2">The play</h3>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] text-ink-2">
              {lesson.play.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="h2">Timeline</h3>
            <ul className="flex flex-col">
              {lesson.timeline.map((t, i) => (
                <li key={i} className="grid grid-cols-[84px_1fr] gap-3 border-b border-line-2 py-3 last:border-b-0">
                  <span className="meta">{t.date}</span>
                  <span className="flex flex-col gap-1.5 text-[14px] text-ink-2">
                    <span>{t.provenance === "illustrative" ? <Illustrative>{t.event}</Illustrative> : t.event}</span>
                    {t.source && <SourceChip href={t.source.url} label={t.source.label} />}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
