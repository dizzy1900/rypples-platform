"use client";
/** S5a: run F1 on a company's source pack, stream evidence and scores, confirm or adjust the binding constraint. */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, GeneratedLabel, Section, Tile } from "@/components/ui";
import { ProgressSteps, type StepState } from "@/components/ui/client";
import { IconExternal } from "@/components/ui/icons";
import { act } from "@/lib/actions";
import { useFlow } from "@/lib/ai/useFlow";
import type { DiagnosticResult, EvidenceItem, ScoredDomain } from "@/lib/ai/types";
import type { DomainOption, PackDoc, ProposedView } from "@/lib/data/projections/diagnostic";
import type { DomainSlug } from "@/lib/domain/schemas";
import { ScoreList } from "./ScoreList";

const STEPS = [
  { key: "read", label: "Reading the pack" },
  { key: "extract", label: "Extracting evidence" },
  { key: "map", label: "Mapping to the 8 domains" },
  { key: "score", label: "Scoring with citations" },
  { key: "playbook", label: "Checking the Playbook" },
  { key: "binding", label: "Proposing the binding constraint" },
];

type View = {
  diagnostic_id: string;
  status: "proposed" | "confirmed" | "disputed";
  confirmed_label: string | null;
  binding_domain: DomainSlug | null;
  proposed_domain: DomainSlug | null;
  binding_statement: string | null;
  scores: ScoredDomain[];
  evidence: EvidenceItem[];
};

function fromResult(r: DiagnosticResult): View {
  return {
    diagnostic_id: r.diagnostic_id,
    status: "proposed",
    confirmed_label: null,
    binding_domain: r.synthesis.binding_domain,
    proposed_domain: r.synthesis.binding_domain,
    binding_statement: r.synthesis.binding_statement,
    scores: r.scores,
    evidence: r.evidence,
  };
}

export function PackDiagnostic({
  company,
  docs,
  proposed,
  domains,
  sourceDates,
}: {
  company: { id: string; slug: string; name: string };
  docs: PackDoc[];
  proposed: ProposedView | null;
  domains: DomainOption[];
  sourceDates: Record<string, string>;
}) {
  const router = useRouter();
  const flow = useFlow<DiagnosticResult>("diagnostic");
  const [cleared, setCleared] = useState(false);
  const running = flow.status === "running";

  const run = async () => {
    setCleared(false);
    const r = await flow.start({ companyId: company.id });
    if (r) router.refresh();
  };
  const reset = () => {
    flow.reset();
    setCleared(true);
  };

  // What to show: the live stream, else the persisted proposal (it carries the confirmed status), else the result.
  const persisted = proposed && (!flow.result || proposed.diagnostic_id === flow.result.id) ? proposed : null;
  const view: View | null = running
    ? null
    : cleared
      ? null
      : persisted ?? (flow.result?.data ? fromResult(flow.result.data) : null);

  const streamScores: ScoredDomain[] = useMemo(
    () =>
      flow.scores.map((x) => ({
        domain: x.domain as DomainSlug,
        score: (x.score == null ? null : Math.max(1, Math.min(5, Math.round(x.score)))) as ScoredDomain["score"],
        confidence: (["low", "medium", "high"].includes(x.confidence) ? x.confidence : "low") as ScoredDomain["confidence"],
        finding: x.finding,
        evidence_ids: x.evidence_ids,
      })),
    [flow.scores],
  );
  const streamEvidence: EvidenceItem[] = useMemo(
    () => flow.evidence.map((e) => ({ id: e.id, claim: e.claim, cited_text: e.cited_text, url: e.url ?? null, title: e.title ?? "Source", location: null })),
    [flow.evidence],
  );

  const steps = STEPS.map((def) => {
    const st = flow.steps.find((x) => x.key === def.key);
    const state: StepState = view && !running ? "done" : !st ? "waiting" : st.state === "done" ? "done" : "running";
    return { key: def.key, label: def.label, state, detail: running ? st?.detail : undefined };
  });

  const label = running ? "Running…" : view || flow.status === "done" ? "Run again" : "Run diagnostic";
  const replaying = flow.replaying;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-8">
        <Section id="pack" title="Source pack" meta={`${docs.length} documents · public record`}>
          <ul className="flex flex-col">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-2 py-3 last:border-b-0">
                <span className="flex flex-col">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[14px] font-medium text-ink hover:text-lime"
                  >
                    {d.title}
                    <IconExternal size={11} />
                  </a>
                  <span className="meta">{d.kind}</span>
                </span>
                <span className="meta">snapshot {d.snapshot}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="run" title="Run">
          <Tile className="flex flex-col gap-5">
            <ProgressSteps steps={steps} />
            {replaying && (running || view) && <p className="meta">Replaying a recent run</p>}
            {flow.status === "error" && !flow.result && (
              <p className="text-[13px] text-amber" role="status">
                {flow.error ?? "Captain couldn't finish this run. Nothing was saved."}
              </p>
            )}
            {flow.fallback && !flow.fallback.replaying && flow.fallback.message && !flow.result && (
              <p className="text-[13px] text-ink-3" role="status">{flow.fallback.message}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={run} disabled={running}>
                {label}
              </Button>
              {(view || flow.status !== "idle") && !running && (
                <Button variant="text" onClick={reset}>
                  Reset
                </Button>
              )}
            </div>
          </Tile>
        </Section>
      </div>

      <div className="flex flex-col gap-8">
        <Section id="scores" title="Scores" meta={running ? `${flow.evidence.length} evidence items found` : undefined}>
          <Tile className="py-2">
            {running ? (
              <ScoreList
                domains={domains}
                scores={streamScores}
                evidence={streamEvidence}
                sourceDates={sourceDates}
                streaming
                emptyText={flow.evidence.length ? `Reading evidence (${flow.evidence.length} items so far)…` : "Reading the pack…"}
              />
            ) : view ? (
              <ScoreList
                domains={domains}
                scores={view.scores}
                evidence={view.evidence}
                bindingDomain={view.binding_domain}
                sourceDates={sourceDates}
              />
            ) : (
              <p className="py-4 text-[14px] text-ink-3">
                Nothing scored yet. Press Run. Scores appear as the agent finds evidence for each domain.
              </p>
            )}
          </Tile>
        </Section>

        {view && view.binding_domain && (
          <BindingPanel key={view.diagnostic_id + view.status} companyId={company.id} view={view} domains={domains} onSaved={() => router.refresh()} />
        )}
      </div>
    </div>
  );
}

function BindingPanel({
  companyId,
  view,
  domains,
  onSaved,
}: {
  companyId: string;
  view: View;
  domains: DomainOption[];
  onSaved: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [domain, setDomain] = useState<DomainSlug | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const label = (d: string | null) => domains.find((x) => x.slug === d)?.label ?? d ?? "";
  const confirmed = view.status === "confirmed";
  const adjusted = !!view.proposed_domain && view.binding_domain !== view.proposed_domain;

  const save = async (domainId: DomainSlug, statement: string | null, why: string | null) => {
    setBusy(true);
    setErr(null);
    const r = await act(
      "constraint.confirmed",
      { company_id: companyId, diagnostic_id: view.diagnostic_id, domain_id: domainId, statement, reason: why },
      { actor: "jerome", entityType: "diagnostic", entityId: view.diagnostic_id },
    );
    setBusy(false);
    if (!r.ok) setErr("Could not save. Try again.");
    else {
      setAdjusting(false);
      onSaved();
    }
  };

  return (
    <Section id="binding" title={confirmed ? "Binding constraint" : "Proposed binding constraint"}>
      <Tile className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">{label(view.binding_domain)}</span>
          {adjusted ? (
            <p className="text-[16px] text-ink">Adjusted from {label(view.proposed_domain)}.</p>
          ) : (
            view.binding_statement && <p className="text-[18px] font-medium text-ink">{view.binding_statement}</p>
          )}
        </div>
        {confirmed ? (
          <p className="meta">{view.confirmed_label ?? "Confirmed by Jerome Ternynck"}</p>
        ) : (
          <>
            <GeneratedLabel extra="Counts once the board-level partner or you confirm it." />
            {adjusting ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!domain || !reason.trim()) {
                    setErr("Choose a domain and give a reason.");
                    return;
                  }
                  void save(domain, null, reason.trim());
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="meta">Binding domain</span>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as DomainSlug)}
                    className="well px-3 py-2 text-[14px] text-ink"
                  >
                    <option value="">Choose a domain</option>
                    {domains
                      .filter((d) => d.slug !== view.binding_domain)
                      .map((d) => (
                        <option key={d.slug} value={d.slug}>
                          {d.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="meta">Reason (required)</span>
                  <textarea
                    value={reason}
                    maxLength={2000}
                    rows={3}
                    onChange={(e) => setReason(e.target.value)}
                    className="well px-3 py-2 text-[14px] text-ink"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save adjustment"}
                  </Button>
                  <Button variant="text" onClick={() => setAdjusting(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setAdjusting(true)} disabled={busy}>
                  Adjust
                </Button>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => view.binding_domain && save(view.binding_domain, view.binding_statement, null)}
                >
                  {busy ? "Confirming…" : "Confirm"}
                </Button>
              </div>
            )}
            {err && (
              <p className="text-[13px] text-amber" role="status">
                {err}
              </p>
            )}
          </>
        )}
      </Tile>
    </Section>
  );
}
