"use client";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Paper } from "@/components/ui";
import { IconPrint } from "@/components/ui/icons";
import { act } from "@/lib/actions";
import type { PackSectionView } from "@/lib/data/projections/bridge";
import { PackSectionBody } from "./PackSectionBody";

/** Preview PDF (print view on Paper) and Share with the board (primary, gated). */
export function PackActions({
  packId,
  companyId,
  companyName,
  heading,
  sections,
  blockers,
  shared,
}: {
  packId: string;
  companyId: string;
  companyName: string;
  heading: string;
  sections: PackSectionView[];
  blockers: string[];
  shared: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState(false);
  const [isShared, setShared] = useState(shared);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setShared(shared), [shared]);

  const blocked = blockers.length > 0;
  const reason = blocked ? `Still needs you: ${blockers.join(", ")}.` : null;

  const share = () => {
    setError(null);
    start(async () => {
      const res = await act("board_pack.shared", { pack_id: packId, company_id: companyId }, { actor: `founder:${companyId}`, entityType: "board_pack", entityId: packId });
      if (!res.ok) return setError("Could not share the pack. Try again.");
      setShared(true);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2 max-sm:items-start">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setPreview(true)}>
          <IconPrint size={16} />
          Preview PDF
        </Button>
        {isShared ? (
          <Button variant="done" disabled aria-live="polite">
            Shared
          </Button>
        ) : (
          <Button variant="primary" onClick={share} disabled={blocked || pending} title={reason ?? undefined} aria-describedby="share-reason">
            {pending ? "Sharing" : "Share with the board"}
          </Button>
        )}
      </div>
      <p id="share-reason" className="meta max-w-[420px] text-right max-sm:text-left" aria-live="polite">
        {isShared ? "Your board can see this pack." : (reason ?? "Every section is ready to share.")}
      </p>
      {error && (
        <p role="alert" className="text-[13px] text-amber">
          {error}
        </p>
      )}
      {preview && <PrintView heading={heading} companyName={companyName} sections={sections} onClose={() => setPreview(false)} />}
    </div>
  );
}

function PrintView({ heading, companyName, sections, onClose }: { heading: string; companyName: string; sections: PackSectionView[]; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div data-print-root role="dialog" aria-modal="true" aria-label="Board pack preview" className="fixed inset-0 z-50 overflow-y-auto bg-abyss">
      <style>{`@media print { body > *:not([data-print-root]) { display: none !important; } [data-print-root] { position: static !important; overflow: visible !important; background: #fff !important; } }`}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line-2 bg-ocean px-6 py-3">
        <p className="text-[13px] text-ink-2">Print view. Choose &ldquo;Save as PDF&rdquo; in the print dialog.</p>
        <div className="flex gap-3">
          <Button onClick={() => window.print()}>
            <IconPrint size={16} />
            Print
          </Button>
          <Button variant="text" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="px-4 py-8">
        <Paper>
          <header className="mb-8 flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] opacity-70">{companyName}</p>
            <h1 className="text-[34px] font-medium leading-[1.1] tracking-[-0.02em]">{heading}</h1>
          </header>
          <div className="flex flex-col gap-10">
            {sections.map((sec) => (
              <div key={sec.key} className="break-inside-avoid">
                <PackSectionBody
                  section={sec}
                  draftLabel={sec.state === "drafted" && !!sec.content}
                  placeholder="Still to be written by the founder."
                />
                {sec.needs && sec.key !== "letter" && <p className="mt-3 text-[13px] italic opacity-70">Still to be completed by the founder.</p>}
              </div>
            ))}
          </div>
        </Paper>
      </div>
    </div>,
    document.body,
  );
}
