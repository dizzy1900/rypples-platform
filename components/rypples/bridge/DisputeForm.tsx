"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { act } from "@/lib/actions";

const inputCls = "well w-full px-3 py-2 text-[14px] text-ink placeholder:text-ink-3";

/** "I see it differently": records constraint.disputed and a decision for Jerome. */
export function DisputeForm({
  companyId,
  companyName,
  slug,
  founderLabel,
  domains,
  disputedLabel,
}: {
  companyId: string;
  companyName: string;
  slug: string;
  founderLabel: string;
  domains: { id: string; label: string }[];
  disputedLabel: string | null;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(disputedLabel != null);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sent)
    return (
      <p className="text-[14px] text-ink" role="status">
        Sent to your board partner. They&rsquo;ll reply within two working days.
      </p>
    );

  if (!open)
    return (
      <Button onClick={() => setOpen(true)} aria-expanded={false} aria-controls={`${id}-form`}>
        I see it differently
      </Button>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (!domain) return setError("Choose the domain you see as the constraint.");
    if (!trimmed) return setError("Add a short note so your board partner has context.");
    if (trimmed.length > 2000) return setError("Keep the note under 2,000 characters.");
    setError(null);
    const label = domains.find((d) => d.id === domain)?.label ?? domain;
    start(async () => {
      const actor = `founder:${companyId}` as const;
      const r1 = await act(
        "constraint.disputed",
        { company_id: companyId, domain_id: domain as never, note: trimmed },
        { actor, entityType: "company", entityId: companyId },
      );
      if (!r1.ok) return setError("Could not send this. Try again.");
      await act(
        "decision.created",
        {
          decision_id: `dec-dispute-${companyId}`,
          company_id: companyId,
          context_label: companyName,
          question: `${founderLabel} sees the constraint differently`,
          line: `${label}: ${trimmed.slice(0, 120)}`,
          action_label: "Review →",
          route: `/os/companies/${slug}`,
        },
        { actor, entityType: "decision", entityId: `dec-dispute-${companyId}` },
      );
      setSent(true);
      router.refresh();
    });
  };

  return (
    <form id={`${id}-form`} onSubmit={submit} className="flex max-w-[560px] flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-domain`} className="meta">
          Where do you see the constraint?
        </label>
        <select id={`${id}-domain`} value={domain} onChange={(e) => setDomain(e.target.value)} className={inputCls} required>
          <option value="">Choose a domain</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-note`} className="meta">
          Your note for your board partner
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={4}
          className={inputCls}
          placeholder="What are you seeing that the diagnostic is not?"
        />
        <span className="meta">{note.length} of 2,000</span>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-amber">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending" : "Send to my board partner"}
        </Button>
        <Button variant="text" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
