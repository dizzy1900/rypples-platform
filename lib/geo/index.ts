import raw from "@/data/geo/markets.json";
import { marketsFileSchema, type MarketsFile } from "./schema";

let cached: MarketsFile | null = null;

/** Loads and validates data/geo/markets.json once. */
export function getMarkets(): MarketsFile {
  if (!cached) cached = marketsFileSchema.parse(raw);
  return cached;
}

export * from "./schema";
export * from "./score";
