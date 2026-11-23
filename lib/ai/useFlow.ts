"use client";
/**
 * Client hook for streamed AI flows (docs/07-ai.md §3).
 *
 *   const flow = useFlow("diagnostic");
 *   flow.start({ companyId: "desolenator" });
 *   flow.steps / flow.evidence / flow.scores / flow.text / flow.refs / flow.status / flow.result / flow.mode
 *
 * The server decides live vs cached; cached mode replays precomputed events through
 * the same stream, so the UI is identical apart from `flow.replaying`.
 */
import { useCallback, useRef, useState } from "react";
import { createSseParser, FLOWS, type FlowEvent, type FlowName, type Ref } from "./sse";

export type FlowStatus = "idle" | "running" | "done" | "error";
export type FlowStep = { key: string; state: "running" | "done"; detail?: string };
export type FlowEvidence = Extract<FlowEvent, { type: "evidence" }>;
export type FlowScore = Extract<FlowEvent, { type: "score" }>;
export type FlowSource = Extract<FlowEvent, { type: "source" }>;

export function useFlow<TResult = unknown>(flow: FlowName) {
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [sources, setSources] = useState<FlowSource[]>([]);
  const [evidence, setEvidence] = useState<FlowEvidence[]>([]);
  const [scores, setScores] = useState<FlowScore[]>([]);
  const [text, setText] = useState("");
  const [refs, setRefs] = useState<Ref[]>([]);
  const [result, setResult] = useState<{ id: string; data?: TResult } | null>(null);
  const [mode, setMode] = useState<"live" | "cached" | null>(null);
  const [fallback, setFallback] = useState<Extract<FlowEvent, { type: "fallback" }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setSteps([]);
    setSources([]);
    setEvidence([]);
    setScores([]);
    setText("");
    setRefs([]);
    setResult(null);
    setMode(null);
    setFallback(null);
    setError(null);
  }, []);

  const start = useCallback(
    async (input: unknown, opts?: { onEvent?: (e: FlowEvent) => void }): Promise<{ id: string; data?: TResult } | null> => {
      reset();
      const ac = new AbortController();
      abortRef.current = ac;
      setStatus("running");
      let final: { id: string; data?: TResult } | null = null;
      let failed = false;
      const onEvent = (e: FlowEvent) => {
        opts?.onEvent?.(e);
        switch (e.type) {
          case "mode":
            setMode(e.mode);
            break;
          case "step":
            setSteps((prev) => {
              const i = prev.findIndex((s) => s.key === e.key);
              const next = { key: e.key, state: e.state, detail: e.detail ?? prev[i]?.detail };
              if (i < 0) return [...prev, next];
              const copy = prev.slice();
              copy[i] = next;
              return copy;
            });
            break;
          case "source":
            setSources((p) => (p.some((s) => s.url === e.url) ? p : [...p, e]));
            break;
          case "evidence":
            setEvidence((p) => [...p, e]);
            break;
          case "score":
            setScores((p) => [...p.filter((s) => s.domain !== e.domain), e]);
            break;
          case "token":
            setText((t) => t + e.text);
            break;
          case "refs":
            setRefs(e.refs);
            break;
          case "fallback":
            setFallback(e);
            if (e.replaying) setMode("cached");
            break;
          case "result":
            final = { id: e.id, data: e.data as TResult };
            setResult(final);
            break;
          case "error":
            failed = true;
            setError(e.message);
            break;
        }
      };
      try {
        const res = await fetch(FLOWS[flow], {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input ?? {}),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parse = createSseParser(onEvent);
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parse(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        failed = true;
        setError("Captain couldn't finish this run. Nothing was saved.");
      }
      setStatus(failed && !final ? "error" : "done");
      return final;
    },
    [flow, reset],
  );

  return {
    start,
    reset,
    abort: () => abortRef.current?.abort(),
    status,
    steps,
    sources,
    evidence,
    scores,
    text,
    refs,
    result,
    mode,
    fallback,
    replaying: mode === "cached" || !!fallback?.replaying,
    error,
  };
}
