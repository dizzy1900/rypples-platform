"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { act } from "@/lib/actions";
import { Button, buttonClass } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";

/** Propose Field Reliability Review: requests the enrolment and adds a ledger commitment. */
export function ProposeReview({ companyId, done }: { companyId: string; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (done)
    return (
      <span className={buttonClass("done")}>
        <IconCheck size={14} />
        Field Reliability Review requested
      </span>
    );
  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const actor = "jerome" as const;
            const a = await act("program.requested", { company_id: companyId, program_id: "field-reliability", via: "board_partner" }, { actor, entityType: "company", entityId: companyId });
            if (!a.ok) {
              setError(a.error);
              return;
            }
            const b = await act(
              "commitment.created",
              {
                commitment_id: `c-field-reliability-${companyId}`,
                company_id: companyId,
                title: "Field Reliability Review: evidence pack",
                from_label: "Independent technical expert",
                due_label: "To be scheduled",
              },
              { actor, entityType: "company", entityId: companyId },
            );
            if (!b.ok) setError(b.error);
            router.refresh();
          })
        }
      >
        {pending ? "Saving" : "Propose Field Reliability Review"}
      </Button>
      {error && <p role="alert" className="text-[13px] text-amber">{error}</p>}
    </div>
  );
}
