"use client";
import { Illustrative, TextLink } from "@/components/ui";
import { ProgressSteps, type StepState } from "@/components/ui/client";
import type { FlowStep } from "@/lib/ai/useFlow";
import type { DayOneSummary } from "@/lib/data/projections/pipeline";

export const DAY_ONE_STEPS = [
  { key: "plan", label: "Turning diligence into the plan" },
  { key: "allocation", label: "Drafting the Growth Engine allocation" },
  { key: "partner", label: "Matching an operating partner (capacity check)" },
  { key: "schedule", label: "Writing the schedule" },
  { key: "bridge", label: "Opening Bridge for Tern's founder" },
  { key: "lessons", label: "Matching Playbook lessons" },
];

/** Map streamed steps onto the six labels: by key when every key is known, else by order of arrival. */
export function mapSteps(steps: FlowStep[]) {
  const known = new Set(DAY_ONE_STEPS.map((s) => s.key));
  const byKey = steps.every((s) => known.has(s.key));
  return DAY_ONE_STEPS.map((def, i) => {
    const st = byKey ? steps.find((s) => s.key === def.key) : steps[i];
    const state: StepState = !st ? "waiting" : st.state === "done" ? "done" : "running";
    return { key: def.key, label: def.label, state, detail: st?.detail };
  });
}

export function DayOneProgress({ steps, replaying }: { steps: FlowStep[]; replaying: boolean }) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <h3 className="text-[15px] font-semibold text-ink">Starting day one</h3>
      {replaying && <p className="meta">Replaying a recent run</p>}
      <ProgressSteps steps={mapSteps(steps)} />
    </div>
  );
}

export function DayOneResultPanel({ r }: { r: DayOneSummary }) {
  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold text-ink">Day one is under way for {r.codename}</h3>
        <p className="meta">Led this session. Home, Portfolio and the rail now include {r.codename}.</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow">Binding constraint</span>
        <p className="text-[14px] text-ink">
          {r.bindingDomain}: {r.binding}
        </p>
        <p className="meta">Confirmed as proposed at IC</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Three priorities</span>
        <ol className="flex flex-col gap-2">
          {r.priorities.map((p) => (
            <li key={p.rank} className="flex flex-col text-[14px] text-ink">
              <span>
                {p.rank}. {p.title}
              </span>
              {p.mission && <span className="meta">Mission: {p.mission}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow">Allocation</span>
        <p className="text-[14px] text-ink">
          {r.started.map((x) => x.name).join(" and ")},{" "}
          <Illustrative>
            {r.hoursStarted} of {r.hoursTotal} hours
          </Illustrative>
        </p>
        {r.deferred.map((d) => (
          <p key={d} className="text-[13px] text-ink-2">
            {d}
          </p>
        ))}
      </div>

      {r.partner && (
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Partner</span>
          <p className="text-[14px] text-ink">
            {r.partner.label}: now {r.partner.seatsUsed} of {r.partner.seatsTotal} seats
          </p>
          {r.partner.note && <p className="text-[13px] text-amber">{r.partner.note}</p>}
        </div>
      )}

      {r.lessons.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Playbook lessons matched</span>
          {r.lessons.map((l) => (
            <p key={l} className="text-[14px] text-ink">
              {l}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <TextLink href={`/bridge/${r.companySlug}`}>Open {r.codename} in Bridge →</TextLink>
        <TextLink href={`/os/companies/${r.companySlug}`}>Open the company record →</TextLink>
        <TextLink href={`/os/companies/${r.companySlug}/schedule`}>View the schedule →</TextLink>
      </div>
    </div>
  );
}
