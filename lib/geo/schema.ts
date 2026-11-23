import { z } from "zod";

export const datasetSchema = z.object({
  id: z.enum(["aqueduct40", "nasa_power", "natural_earth"]),
  accessed_at: z.string(),
  attribution: z.string(),
  url: z.string(),
});

export const waterStressSchema = z.object({
  basin_score: z.number().min(0).max(5),
  basin_label: z.string(),
  country_score: z.number().min(0).max(5),
  country_label: z.string(),
  projected_2030_label: z.string().nullable(),
  basin_from_country: z.boolean().optional(),
  basin_match: z.enum(["within", "nearest"]).optional(),
  basin_match_km: z.number().optional(),
  provenance: z.enum(["aqueduct", "illustrative"]).optional(),
});

export const presenceSchema = z.object({
  kind: z.enum(["pilot", "precedent"]).nullable(),
  label: z.string().nullable(),
  source_id: z.string().nullable(),
});

export const marketSchema = z.object({
  iso3: z.string().length(3),
  country: z.string(),
  site: z.object({ name: z.string(), lat: z.number(), lon: z.number() }),
  water_stress: waterStressSchema,
  solar_kwh_m2_day: z.number().positive(),
  presence: presenceSchema,
  rypples_coverage: z.boolean(),
});

export const pinSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  kind: z.enum(["pilot", "precedent"]),
  source_id: z.string(),
});

export const marketsFileSchema = z.object({
  generated_at: z.string(),
  datasets: z.array(datasetSchema),
  markets: z.array(marketSchema).min(1),
  pins: z.array(pinSchema),
});

export type Dataset = z.infer<typeof datasetSchema>;
export type Market = z.infer<typeof marketSchema>;
export type Pin = z.infer<typeof pinSchema>;
export type MarketsFile = z.infer<typeof marketsFileSchema>;
