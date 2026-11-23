"use client";
import { useState, useTransition } from "react";
import { stableId } from "@/components/ui/client";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { act } from "@/lib/actions";

/** Five-step rating as an accessible radio group, optimistic, recorded as commitment.rated. */
export function RatingControl({ commitmentId, companyId, title, initial }: { commitmentId: string; companyId: string; title: string; initial: number | null }) {
  const name = stableId("rate", commitmentId);
  const router = useRouter();
  const [value, setValue] = useState<number | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const rate = (n: number) => {
    const prev = value;
    setValue(n);
    setError(null);
    start(async () => {
      const res = await act("commitment.rated", { commitment_id: commitmentId, rating: n }, { actor: `founder:${companyId}`, entityType: "commitment", entityId: commitmentId });
      if (!res.ok) {
        setValue(prev);
        setError("Could not save your rating. Try again.");
      } else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label={`Rate: ${title}`} className="inline-flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const checked = value === n;
          const filled = value != null && n <= value;
          return (
            <label
              key={n}
              className={clsx(
                "relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-btn border text-[12px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-lime",
                filled ? "border-lime bg-lime-10 text-lime" : "border-line-2 bg-surface text-ink-3 hover:text-ink",
                checked && "bg-lime-15",
              )}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={checked}
                onChange={() => rate(n)}
                className="sr-only"
                aria-label={`${n} of 5`}
              />
              <span aria-hidden>{n}</span>
            </label>
          );
        })}
      </div>
      <span className="meta" aria-live="polite">
        {error ?? (value ? `Rated ${value} of 5` : "Not rated yet")}
      </span>
    </div>
  );
}
