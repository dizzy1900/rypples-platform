"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Button, Illustrative, Meta, SourceChip, Tile } from "@/components/ui";
import { IconPause, IconPlay } from "@/components/ui/icons";
import type { PlaybookView } from "@/lib/data/projections/playbook";

const INTERVAL_MS = 2500;

export function Replay({ steps, company }: { steps: PlaybookView["replay"]; company: string }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const last = steps.length - 1;
  const iRef = useRef(i);
  iRef.current = i;

  useEffect(() => {
    if (!playing || reduce) return;
    const t = setInterval(() => {
      if (iRef.current >= last) {
        setPlaying(false);
        return;
      }
      setI(iRef.current + 1);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [playing, reduce, last]);

  const onPlay = () => {
    if (reduce) {
      // no auto-advance: Play steps once
      setI((cur) => (cur >= last ? 0 : cur + 1));
      return;
    }
    if (i >= last) setI(0);
    setPlaying(true);
  };

  if (steps.length === 0) return null;
  const step = steps[i];

  return (
    <Tile className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <fieldset className="min-w-0 flex-1">
          <legend className="sr-only">Replay {company}: choose a date</legend>
          <div className="relative flex items-start justify-between gap-2 pt-2">
            <span aria-hidden className="absolute left-3 right-3 top-[15px] h-px bg-line-2" />
            <span
              aria-hidden
              className="absolute left-3 top-[15px] h-px bg-lime"
              style={{ width: `calc((100% - 24px) * ${last ? i / last : 0})` }}
            />
            {steps.map((s, idx) => (
              <label key={s.id} className="relative flex cursor-pointer flex-col items-center gap-2 text-center">
                <input
                  type="radio"
                  name="replay-step"
                  value={idx}
                  checked={idx === i}
                  onChange={() => {
                    setPlaying(false);
                    setI(idx);
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`block h-[14px] w-[14px] rounded-full border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime ${
                    idx <= i ? "border-lime bg-lime" : "border-ink-3 bg-ocean"
                  }`}
                />
                <span className={`text-[12px] font-medium ${idx === i ? "text-ink" : "text-ink-3"}`}>{s.at}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button variant="outline" onClick={playing ? () => setPlaying(false) : onPlay} aria-label={playing ? "Pause replay" : "Play replay"}>
          {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
          {playing ? "Pause" : "Play"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2" aria-live="polite">
        <div className="flex flex-col gap-2 lg:border-r lg:border-line-2 lg:pr-6">
          <h4 className="h2">What happened</h4>
          <Meta>
            {step.at} · {step.label}
          </Meta>
          <p className="text-[14px] text-ink-2">{step.illustrative ? <Illustrative>{step.event}</Illustrative> : step.event}</p>
          <div>
            {step.source ? <SourceChip href={step.source.href} label={step.source.label} /> : <Meta>Illustrative · no public source yet</Meta>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="h2">How the platform would have read it</h4>
          <Meta>Illustrative</Meta>
          <p className="text-[14px] text-ink-2">
            <Illustrative note="A reading of how Rypples OS would have flagged this at the time">{step.read}</Illustrative>
          </p>
        </div>
      </div>
    </Tile>
  );
}
