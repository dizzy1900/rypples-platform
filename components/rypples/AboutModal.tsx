"use client";
/** "What's real and what's illustrative": opens from the Welcome link, or when the URL has ?about=1. Esc closes. */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/client";

const CLASSES: { name: string; example: string; text: string }[] = [
  {
    name: "Public",
    example: "Plain text, with a source chip",
    text: "Facts about real companies, such as Desolenator's 40 m³/hour system or Fincantieri's majority stake in WSense. Each one links to where it was read.",
  },
  {
    name: "Scenario",
    example: "Plain text",
    text: "The story the demo tells: Rypples leads Desolenator's next round, which closed on 15 Oct 2026, and takes a board seat. In reality Rypples does not hold that seat. Day counts and this week's dates follow the scenario date.",
  },
  {
    name: "Illustrative",
    example: "Dotted underline",
    text: "Scores' exact values, days open, benchmarks, ratings, allocations, capacity and the ledger. They show how the platform would read, not what is true today.",
  },
  {
    name: "Generated",
    example: "Proposed, drafted by Captain",
    text: "Output written by AI during the demo. Every piece is a proposal with its sources, and nothing counts until a named person approves it.",
  },
];

export function AboutModal() {
  const sp = useSearchParams();
  const fromUrl = sp.get("about") === "1";
  const [open, setOpen] = useState(fromUrl);
  useEffect(() => setOpen(fromUrl), [fromUrl]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("about")) {
        u.searchParams.delete("about");
        window.history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
      }
    } catch {
      /* history unavailable: the modal is closed either way */
    }
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-link text-[14px]">
        What&rsquo;s real and what&rsquo;s illustrative
      </button>
      <Modal open={open} onClose={close} title="What's real and what's illustrative" width={640}>
        <div className="flex flex-col gap-5 pb-4 text-[14px] text-ink-2">
          <p>
            This is a prototype built on public information and a made-up scenario. Every number or statement falls into exactly one of four
            classes, and the screen shows which.
          </p>
          <dl className="flex flex-col">
            {CLASSES.map((c) => (
              <div key={c.name} className="grid gap-1 border-t border-line-2 py-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                <dt className="flex flex-col">
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="meta">{c.example}</span>
                </dt>
                <dd>{c.text}</dd>
              </div>
            ))}
          </dl>
          <p>
            Pipeline companies such as Project Tern are fictional codenames. Operating partners appear by role and initials only. Diagnoses of real
            portfolio companies are evidence-led hypotheses from public sources, not conclusions, and they never speculate about financials.
          </p>
        </div>
      </Modal>
    </>
  );
}
