"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { act } from "@/lib/actions";
import { Button, Illustrative, Meta, SourceChip, Tile } from "@/components/ui";
import type { PlaybookView } from "@/lib/data/projections/playbook";

export function LessonCard({ lesson }: { lesson: PlaybookView["lesson"] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [play, setPlay] = useState(lesson.play);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Could not save");
      after?.();
      router.refresh();
    });
  };

  const save = () =>
    run(
      () =>
        act(
          "lesson.edited",
          { lesson_id: lesson.id, title: title.trim() || lesson.title, play: play.map((p) => p.trim()).filter(Boolean) },
          { actor: "jerome", entityType: "lesson", entityId: lesson.id },
        ) as Promise<{ ok: boolean; error?: string }>,
      () => setEditing(false),
    );

  const approve = () =>
    run(
      () =>
        act("lesson.approved", { lesson_id: lesson.id }, { actor: "jerome", entityType: "lesson", entityId: lesson.id }) as Promise<{
          ok: boolean;
          error?: string;
        }>,
    );

  return (
    <Tile className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="meta" aria-live="polite">
          {lesson.statusLine}
        </p>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lesson-title" className="meta">
              Title
            </label>
            <textarea
              id="lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className="well w-full rounded-item px-3 py-2 font-display text-[22px] leading-[1.2] text-ink"
            />
          </div>
        ) : (
          <h3 className="font-display text-[26px] font-medium leading-[1.15] tracking-[-0.02em] text-ink">{lesson.title}</h3>
        )}
        <Meta>
          {lesson.domain} · learned in {lesson.learnedIn}
        </Meta>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="h2">{lesson.learnedIn} timeline</h4>
        <ol className="flex flex-col">
          {lesson.timeline.map((t, i) => (
            <li key={i} className="grid gap-1 border-t border-line-2 py-3 sm:grid-cols-[90px_1fr] sm:gap-5">
              <span className="meta uppercase tracking-[0.12em]">{t.date}</span>
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] text-ink">{t.label}</span>
                <span className="text-[13px] text-ink-2">{t.illustrative ? <Illustrative>{t.event}</Illustrative> : t.event}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {t.source ? <SourceChip href={t.source.href} label={t.source.label} /> : <span className="meta">Illustrative · no public source yet</span>}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="h2">The play</h4>
        <ol className="flex flex-col gap-3">
          {(editing ? play : lesson.play).map((p, i) => (
            <li key={i} className="grid grid-cols-[24px_1fr] gap-3 text-[14px] text-ink-2">
              <span className="font-display text-[18px] text-lime">{i + 1}</span>
              {editing ? (
                <>
                  <label className="sr-only" htmlFor={`play-${i}`}>
                    Step {i + 1}
                  </label>
                  <textarea
                    id={`play-${i}`}
                    value={p}
                    rows={2}
                    onChange={(e) => setPlay((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                    className="well w-full rounded-item px-3 py-2 text-[14px] text-ink"
                  />
                </>
              ) : (
                <span>{p}</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <Button variant="outline" onClick={save} disabled={pending}>
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setTitle(lesson.title);
                setPlay(lesson.play);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setTitle(lesson.title);
              setPlay(lesson.play);
              setEditing(true);
            }}
          >
            Edit
          </Button>
        )}
        {lesson.approved ? (
          <Button variant="done" disabled>
            Approved
          </Button>
        ) : (
          <Button variant="primary" onClick={approve} disabled={pending || editing}>
            Approve lesson
          </Button>
        )}
        {error && (
          <span role="alert" className="text-[13px] text-amber">
            {error}
          </span>
        )}
      </div>
    </Tile>
  );
}
