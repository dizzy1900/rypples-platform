"use client";
/** Placeholder until the Captain drawer (S10) is built. */
import { DrawerHeader } from "@/components/ui/client";
import { IconWheel } from "@/components/ui/icons";

export type CaptainScope = { kind: "os" } | { kind: "bridge"; slug: string; companyName: string };

export function CaptainDrawer({ onClose }: { scope: CaptainScope; onClose: () => void; prefill?: string }) {
  return (
    <>
      <DrawerHeader title="Captain" meta="Works across Rypples OS, Bridge and your connected tools" onClose={onClose} icon={<IconWheel />} />
      <div className="p-6 text-ink-3">Loading Captain…</div>
    </>
  );
}
