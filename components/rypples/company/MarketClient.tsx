"use client";
import { MarketEvidence } from "@/components/rypples/MarketEvidence";
import { useCaptain } from "@/components/ui/client";
import type { Dataset, Market, Pin } from "@/lib/geo/schema";

export function MarketClient({ markets, pins, datasets }: { markets: Market[]; pins: Pin[]; datasets: Dataset[] }) {
  const { open } = useCaptain();
  return <MarketEvidence markets={markets} pins={pins} datasets={datasets} onAskCaptain={(p) => open(p)} />;
}
