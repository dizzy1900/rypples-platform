# 09 · Market evidence (geodata)

**Purpose:** back Desolenator's binding constraint (asset capital for plants) with physical data. A lender's first questions about a solar desalination plant are whether demand for its water is credible and whether the sun is reliable. This module ranks candidate markets on both, transparently, from open datasets.

The method is general. Any company can get a "market physics" layer from the indicators that matter to its model. The prototype implements it for Desolenator.

## 1. Data sources

| Indicator | Dataset | Licence and attribution | Use |
|---|---|---|---|
| Baseline water stress (basin level at the site, plus country context) | WRI Aqueduct 4.0: global maps (HydroBASIN level 6) and country rankings | CC BY 4.0. Register on download. Attribute "Source: WRI Aqueduct, accessed on {date}" with a link to aqueduct.wri.org | Demand for new water |
| Projected water stress 2030 (business as usual) | Aqueduct 4.0 future projections | As above | Direction of travel (shown, not scored by default) |
| Solar resource (all-sky surface shortwave downward irradiance, long-term annual mean) | NASA POWER Climatology API, `ALLSKY_SFC_SW_DWN`, `community=RE`, at the site point | NASA POWER, public. Attribute "NASA POWER" with a link | Plant output potential |
| Country boundaries | Natural Earth 1:110m via the `world-atlas` topojson | Public domain | Map |
| Presence | Seed: Desolenator pilots (DEWA, Silal) and precedent (Cambodia) | Public, with sources | Existing footprint |

Read the Aqueduct data dictionary (`github.com/wri/Aqueduct40`) to pick the exact field names. Use the baseline water stress score (0–5) and label, the "all sectors" weighting at country level, and the basin value at the site point.

## 2. Build pipeline (`pnpm build:geo`, run locally and commit the output)

`scripts/geo/` is a Python 3.11 script set with its own `requirements.txt`: geopandas, shapely, requests and pandas. It runs offline from the app.

1. **Inputs:**
   - `data/geo/candidates.json`: the candidate markets with a representative coastal site point (below).
   - The downloaded Aqueduct files in `data/geo/raw/`, which are git-ignored. The download page requires a registration form, so download by hand.
2. **Basin lookup:** point-in-polygon of each site against the HydroBASIN level 6 layer gives the basin's baseline water stress score, label and 2030 projection.
3. **Country context:** join the country rankings by ISO3 to get the country baseline water stress score and label.
4. **Solar:** `GET https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&format=JSON`.
   - Read the annual value and its `units` from the response. Store kWh/m²/day, converting from MJ/m²/day ÷ 3.6 if that's what was returned.
   - Cache raw responses in `data/geo/raw/power/`.
5. **Output:** `data/geo/markets.json` (schema §3), with an `accessed_at` per dataset. Validate it with zod in a unit test.

### Candidate markets (editable)

All site coordinates are approximate. Verify each when building.

| Region | Markets (representative coastal site) |
|---|---|
| Gulf and MENA | UAE (Abu Dhabi), Saudi Arabia (Jeddah), Oman (Muscat), Qatar (Doha), Kuwait (Kuwait City), Bahrain (Manama), Jordan (Aqaba), Egypt (Hurghada), Morocco (Agadir), Tunisia (Sfax) |
| Mediterranean Europe | Spain (Almería), Cyprus (Larnaca), Greece (Heraklion), Italy (Palermo) |
| Americas | Chile (Antofagasta), Peru (Lima), Mexico (La Paz, Baja California Sur) |
| Africa | Namibia (Walvis Bay), South Africa (Cape Town) |
| Asia-Pacific | India (Chennai), Pakistan (Karachi), Australia (Perth), Cambodia (Sihanoukville) |

## 3. `markets.json` schema

```ts
{
  generated_at: string,
  datasets: { id: "aqueduct40" | "nasa_power" | "natural_earth", accessed_at: string, attribution: string, url: string }[],
  markets: {
    iso3: string, country: string, site: { name: string, lat: number, lon: number },
    water_stress: { basin_score: number /*0–5*/, basin_label: string, country_score: number, country_label: string,
                    projected_2030_label: string | null },
    solar_kwh_m2_day: number,
    presence: { kind: "pilot" | "precedent" | null, label: string | null, source_id: string | null },
    rypples_coverage: boolean          // a board-level partner's focus covers this region (seed-derived)
  }[]
}
```

## 4. Scoring (`lib/geo/score.ts`, pure and unit-tested)

```
water  = basin_score / 5                                   // absolute scale, 0–1
solar  = (solar − min(solar)) / (max(solar) − min(solar))  // relative across candidates
present = presence.kind ? 1 : 0
composite = (w_water·water + w_solar·solar + w_present·present) / (w_water + w_solar + w_present)
```

- Default weights: water 50, solar 30, presence 20. The sliders change the weights, and the result re-normalises.
- Ties are broken by water stress, then by solar resource.
- "Why these three" uses templates from indicator values, for example: "{Country}: basin water stress {label} ({score}/5) and {solar} kWh/m²/day of sun. {Presence sentence}."
- The output includes `components` per market so the UI can show the contribution of each indicator.

**Honesty:** the caveat on S4b is always visible. Composite scores are relative rankings, not forecasts. The 2030 projection is shown for context and is not scored unless the user turns on a "Use 2030 projection" toggle, which swaps `basin_score` for the projected value.

## 5. Map (`components/rypples/MarketMap.tsx`)

- d3-geo `geoNaturalEarth1`, fitted to the bounding box of the candidates with 6% padding. A "World" toggle shows the full extent.
- Countries come from the `world-atlas` 110m topojson via topojson-client.
  - Candidate countries are filled on a five-step lime ramp by composite score: lime at 15% for the lowest bucket, up to solid lime for the highest.
  - Non-candidate countries are filled white 6%, with line strokes at white 10%.
- Site points: 4px dots. Pilots show a 10px lime ring, and the precedent a dashed ring.
- Interaction: hover or focus on a candidate shows a tooltip (country, site, basin stress label and score, solar, presence). The countries are focusable in rank order. Clicking a country scrolls to and highlights its row in the list.
- Compact mode (S13): no toggle, top 5 highlighted, 220px tall.
- Rendered as SVG on the server for first paint, then hydrated for interaction. No map tiles or API keys.
