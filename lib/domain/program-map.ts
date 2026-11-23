/** Deterministic priority-intent → program lookup used by F7 (docs/07-ai.md F7 step 2). */
export const INTENTS = [
  "fund_assets",
  "convert_pilots",
  "key_hire",
  "certify",
  "prove_reliability",
  "map_strategics",
  "automate_ops",
  "evidence_impact",
] as const;
export type Intent = (typeof INTENTS)[number];

export const PROGRAM_FOR_INTENT: Record<Intent, string> = {
  fund_assets: "finance-sprint",
  convert_pilots: "pilot-to-contract",
  key_hire: "key-hire",
  certify: "certification",
  prove_reliability: "field-reliability",
  map_strategics: "partner-map",
  automate_ops: "ai-ops",
  evidence_impact: "impact-evidence",
};

export const programForIntent = (i: Intent) => PROGRAM_FOR_INTENT[i];
