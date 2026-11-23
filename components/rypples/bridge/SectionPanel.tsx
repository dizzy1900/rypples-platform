"use client";
import { useEffect, useState, useTransition } from "react";
import { stableId } from "@/components/ui/client";
import { useRouter } from "next/navigation";
import { Button, Paper, StatusDot } from "@/components/ui";
import { ProgressSteps } from "@/components/ui/client";
import { act } from "@/lib/actions";
import { useFlow } from "@/lib/ai/useFlow";
import type { BoardPackDraft } from "@/lib/ai/types";
import type { PackSectionView } from "@/lib/data/projections/bridge";
import { PackSectionBody } from "./PackSectionBody";

const inputCls = "well w-full px-3 py-2 text-[14px] text-ink placeholder:text-ink-3";
const STEP_LABELS: Record<string, string> = {
  context: "Reading your plan and ledger",
  draft: "Writing the draft",
  guardrail: "Checking for figures that are not in your records",
};
const humanize = (k: string) => STEP_LABELS[k] ?? k.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

type Mode = "view" | "edit" | "pilots" | "ops";
type Pilot = { id: string; name: string; stage: number };

export function SectionPanel({
  packId,
  companyId,
  section,
  pilots,
  stages,
}: {
  packId: string;
  companyId: string;
  section: PackSectionView;
  pilots: Pilot[];
  stages: string[];
}) {
  const router = useRouter();
  const flow = useFlow<BoardPackDraft>("board-pack");
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState("");
  const [aiDraft, setAiDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const actor = `founder:${companyId}` as const;
  const entity = { actor, entityType: "board_pack", entityId: packId } as const;

  const editable = section.key === "letter" || section.key === "asks";
  const seedText = section.content ?? (section.key === "asks" ? section.paragraphs.join("\n\n") : "");

  // stream tokens into the editor and the preview
  useEffect(() => {
    if (flow.status === "running" || (flow.status === "done" && flow.text && !flow.result?.data)) setDraft(flow.text);
  }, [flow.text, flow.status, flow.result]);
  useEffect(() => {
    const d = flow.result?.data?.content_md;
    if (d) setDraft(d);
  }, [flow.result]);

  const openEditor = () => {
    setError(null);
    setNote(null);
    setDraft(seedText);
    setAiDraft(false);
    setMode("edit");
  };
  const runDraft = async () => {
    setError(null);
    setNote(null);
    setMode("edit");
    setAiDraft(true);
    setDraft("");
    await flow.start({ companyId, sectionKey: section.key });
  };

  const save = (state: "drafted" | "ready") => {
    const text = draft.trim();
    if (!text) return setError("Write or draft something first.");
    if (text.length > 6000) return setError("Keep this under 6,000 characters.");
    setError(null);
    start(async () => {
      const res = await act("board_pack.section_saved", { pack_id: packId, section_key: section.key, content_md: text, state }, entity);
      if (!res.ok) return setError("Could not save. Try again.");
      setNote(state === "ready" ? "Marked ready." : "Draft saved.");
      setMode("view");
      setAiDraft(false);
      router.refresh();
    });
  };

  // pilots
  const [stageSel, setStageSel] = useState<Record<string, number>>(() => Object.fromEntries(pilots.map((p) => [p.id, p.stage])));
  const confirmStages = () => {
    setError(null);
    start(async () => {
      for (const p of pilots) {
        const r = await act("pilot.stage_confirmed", { pilot_id: p.id, stage: stageSel[p.id] ?? p.stage }, { actor, entityType: "pilot", entityId: p.id });
        if (!r.ok) return setError("Could not save a stage. Try again.");
      }
      const res = await act("board_pack.section_saved", { pack_id: packId, section_key: "pilots", content_md: null, state: "ready" }, entity);
      if (!res.ok) return setError("Could not mark the section ready. Try again.");
      setNote("Stages confirmed.");
      setMode("view");
      router.refresh();
    });
  };

  // ops
  const [site, setSite] = useState("");
  const [uptime, setUptime] = useState("");
  const [output, setOutput] = useState("");
  const addOps = (e: React.FormEvent) => {
    e.preventDefault();
    const u = Number(uptime);
    const o = Number(output);
    if (!site.trim()) return setError("Enter the plant or site name.");
    if (uptime.trim() === "" || !Number.isFinite(u) || u < 0 || u > 100) return setError("Uptime must be a number from 0 to 100.");
    if (output.trim() === "" || !Number.isFinite(o) || o < 0 || o > 1_000_000) return setError("Output must be a number of m³ per day, zero or more.");
    setError(null);
    start(async () => {
      const res = await act("board_pack.ops_added", { pack_id: packId, site: site.trim().slice(0, 200), uptime_pct: u, output_m3_day: o }, entity);
      if (!res.ok) return setError("Could not save. Try again.");
      setSite("");
      setUptime("");
      setOutput("");
      setNote("Added. Values are labelled founder-entered.");
      setMode("view");
      router.refresh();
    });
  };

  const formId = stableId("pack", packId, section.key);
  const running = flow.status === "running";
  const previewText = mode === "edit" && editable ? draft : null;
  const showDraftLabel = (mode === "edit" && aiDraft && draft.length > 0) || (mode !== "edit" && section.state === "drafted" && !!section.content);

  return (
    <div className="flex flex-col gap-5">
      <div aria-live={running ? "polite" : "off"} aria-busy={running}>
        <Paper className="max-w-none">
          <PackSectionBody
            section={section}
            textOverride={previewText}
            draftLabel={showDraftLabel}
            placeholder={section.key === "letter" ? "Not written yet. The outline below is what Bridge suggests covering." : null}
          />
        </Paper>
      </div>

      <div className="tile flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusDot tone={section.state === "ready" ? "lime" : section.state === "needs" ? "amber" : "neutral"} label={section.stateLabel} />
        </div>

        {section.needText && mode === "view" && <p className="text-[14px] text-ink">{section.needText}</p>}

        {section.key === "fin" && (
          <div className="flex flex-col gap-1">
            <p className="text-[14px]">From the finance system you connected (demo). Rypples never edits these.</p>
            <p className="meta">Demo connection</p>
          </div>
        )}
        {section.key === "plan" && <p className="text-[14px]">Pulled from your Bridge plan and ledger. Nothing for you to add.</p>}

        {mode === "view" && (
          <div className="flex flex-wrap items-center gap-3">
            {section.key === "letter" && (
              <>
                <Button onClick={openEditor}>{section.needs && !section.content ? "Start writing" : "Edit letter"}</Button>
                <Button onClick={runDraft}>Draft from my plan</Button>
              </>
            )}
            {section.key === "asks" && (
              <>
                <Button onClick={runDraft}>Redraft</Button>
                <Button onClick={openEditor}>Edit asks</Button>
              </>
            )}
            {section.key === "pilots" && pilots.length > 0 && (
              <Button
                onClick={() => {
                  setError(null);
                  setNote(null);
                  setStageSel(Object.fromEntries(pilots.map((p) => [p.id, p.stage])));
                  setMode("pilots");
                }}
              >
                {section.needs ? "Confirm stages" : "Change stages"}
              </Button>
            )}
            {section.key === "ops" && (
              <>
                <Button
                  onClick={() => {
                    setError(null);
                    setNote(null);
                    setMode("ops");
                  }}
                >
                  {section.founderEntered ? "Add another site" : "Add data"}
                </Button>
                <Button disabled title="Available when telemetry is connected" aria-describedby={`${formId}-tel`}>
                  Connect plant telemetry
                </Button>
                <span id={`${formId}-tel`} className="meta">
                  Available when telemetry is connected
                </span>
              </>
            )}
          </div>
        )}

        {mode === "edit" && (
          <div className="flex flex-col gap-3">
            <label htmlFor={`${formId}-text`} className="meta">
              {section.name}
            </label>
            {running && flow.steps.length > 0 && (
              <ProgressSteps steps={flow.steps.map((s) => ({ key: s.key, label: humanize(s.key), state: s.state, detail: s.detail }))} />
            )}
            {flow.replaying && <p className="meta">Replaying a recent run</p>}
            <textarea
              id={`${formId}-text`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={section.key === "letter" ? 14 : 9}
              maxLength={6000}
              readOnly={running}
              className={inputCls}
              placeholder={section.key === "letter" ? "Write in your own voice. Plain paragraphs, lists and emphasis are supported." : undefined}
            />
            <p className="meta">
              {draft.length} of 6,000
              {aiDraft && !running && draft ? " · Draft · edit before sharing" : ""}
            </p>
            {flow.status === "error" && (
              <p role="alert" className="text-[13px] text-amber">
                {flow.error ?? "Captain couldn't finish this run. Nothing was saved."} You can still write it yourself.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => save("drafted")} disabled={pending || running}>
                Save draft
              </Button>
              <Button onClick={() => save("ready")} disabled={pending || running}>
                Mark ready
              </Button>
              <Button onClick={runDraft} disabled={pending || running}>
                {section.key === "asks" ? "Redraft" : "Draft from my plan"}
              </Button>
              <Button
                variant="text"
                disabled={pending}
                onClick={() => {
                  flow.abort();
                  setMode("view");
                  setAiDraft(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "pilots" && (
          <div className="flex flex-col gap-4">
            <p className="meta">Stages are yours to confirm. Each choice is recorded.</p>
            <ul className="flex flex-col gap-3">
              {pilots.map((p) => (
                <li key={p.id} className="grid items-center gap-2 sm:grid-cols-[1fr_200px]">
                  <label htmlFor={`${formId}-${p.id}`} className="text-[14px] text-ink">
                    {p.name}
                  </label>
                  <select
                    id={`${formId}-${p.id}`}
                    className={inputCls}
                    value={stageSel[p.id] ?? p.stage}
                    onChange={(e) => setStageSel((m) => ({ ...m, [p.id]: Number(e.target.value) }))}
                  >
                    <option value={0}>Not started</option>
                    {stages.map((st, i) => (
                      <option key={st} value={i + 1}>
                        {st}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button onClick={confirmStages} disabled={pending}>
                {pending ? "Saving" : "Confirm stages"}
              </Button>
              <Button variant="text" onClick={() => setMode("view")} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "ops" && (
          <form onSubmit={addOps} className="flex flex-col gap-4" noValidate>
            <p className="meta">Values are session-scoped and labelled founder-entered.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-site`} className="meta">
                  Site
                </label>
                <input id={`${formId}-site`} className={inputCls} value={site} onChange={(e) => setSite(e.target.value)} maxLength={200} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-up`} className="meta">
                  Uptime %
                </label>
                <input id={`${formId}-up`} className={inputCls} inputMode="decimal" value={uptime} onChange={(e) => setUptime(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-out`} className="meta">
                  Output m³/day
                </label>
                <input id={`${formId}-out`} className={inputCls} inputMode="decimal" value={output} onChange={(e) => setOutput(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving" : "Add data"}
              </Button>
              <Button variant="text" onClick={() => setMode("view")} disabled={pending}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {error && mode !== "edit" && (
          <p role="alert" className="text-[13px] text-amber">
            {error}
          </p>
        )}
        {error && mode === "edit" && flow.status !== "error" && (
          <p role="alert" className="text-[13px] text-amber">
            {error}
          </p>
        )}
        {note && (
          <p className="text-[13px] text-ink" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
