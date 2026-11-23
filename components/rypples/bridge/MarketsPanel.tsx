"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/client";
import { MarketEvidence } from "@/components/rypples/MarketEvidence";
import type { Dataset, Market, Pin } from "@/lib/geo/schema";

/** Compact top-5 markets, with the full evidence (weights adjustable) in a sheet. Founder-scoped: no Ask Captain. */
export function MarketsPanel({ markets, pins, datasets }: { markets: Market[]; pins: Pin[]; datasets: Dataset[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <MarketEvidence markets={markets} pins={pins} datasets={datasets} compact />
      <div>
        <Button variant="text" onClick={() => setOpen(true)} aria-haspopup="dialog">
          See all markets and adjust weights →
        </Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Where the next plants go" meta="All candidate markets. Adjust the weights to re-rank." width={1000}>
        <MarketEvidence markets={markets} pins={pins} datasets={datasets} />
      </Sheet>
    </div>
  );
}
