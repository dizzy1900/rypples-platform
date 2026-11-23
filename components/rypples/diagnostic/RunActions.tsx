"use client";
/** S5b run page footer: Run again (budget-gated), Copy link, Add to pipeline as a codename. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { CopyButton } from "@/components/ui/client";
import { act } from "@/lib/actions";
import { useFlow } from "@/lib/ai/useFlow";
import { dealFromRun, pickCodename } from "@/lib/ai/deal-from-run";
import type { AnyCompanyResult } from "@/lib/ai/types";
import { F2Progress } from "./F2Progress";

export function RunActions({
  run,
  shareUrl,
  runAgainAllowed,
  takenCodenames,
}: {
  run: AnyCompanyResult;
  shareUrl: string;
  runAgainAllowed: boolean;
  takenCodenames: string[];
}) {
  const router = useRouter();
  const flow = useFlow<AnyCompanyResult>("any-company");
  const [added, setAdded] = useState<{ id: string; codename: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const running = flow.status === "running";

  const again = async () => {
    const r = await flow.start({ query: run.identity.website ?? run.identity.name, runAgain: true });
    if (r && r.id !== run.run_id) router.push(`/os/diagnostic/runs/${r.id}`);
    else router.refresh();
  };

  const addToPipeline = async () => {
    setBusy(true);
    setErr(null);
    const codename = pickCodename(takenCodenames);
    const id = `deal-src-${Date.now().toString(36)}`;
    const res = await act("deal.created", { deal: dealFromRun(run, codename, id) as unknown as Record<string, unknown> }, {
      actor: "jerome",
      entityType: "deal",
      entityId: id,
    });
    setBusy(false);
    if (res.ok) setAdded({ id, codename });
    else setErr("Could not add the deal. Try again.");
  };

  const pausedMsg = flow.fallback && !flow.fallback.replaying && !flow.result ? flow.fallback.message : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={again} disabled={!runAgainAllowed || running} title={runAgainAllowed ? undefined : "Run again is paused for today"}>
          {running ? "Running…" : "Run again"}
        </Button>
        <CopyButton text={shareUrl} label="Copy link" />
        {added ? (
          <Link href={`/os/pipeline?deal=${added.id}`} className="text-link text-[13px]">
            Open {added.codename} in Pipeline →
          </Link>
        ) : (
          <Button variant="text" onClick={addToPipeline} disabled={busy}>
            {busy ? "Adding…" : "Add to pipeline as a codename"}
          </Button>
        )}
      </div>
      {!runAgainAllowed && <p className="meta">Run again is paused for today. This run stays available.</p>}
      {running && <F2Progress steps={flow.steps} sources={flow.sources} evidenceCount={flow.evidence.length} replaying={flow.replaying} />}
      {pausedMsg && <p className="text-[13px] text-ink-3" role="status">{pausedMsg}</p>}
      {flow.status === "error" && <p className="text-[13px] text-amber" role="status">Captain couldn&rsquo;t finish this run. Nothing was saved.</p>}
      {err && <p className="text-[13px] text-amber" role="status">{err}</p>}
    </div>
  );
}
