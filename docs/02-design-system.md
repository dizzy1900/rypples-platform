# 02 · Design system

The platform should look like a drop-in extension of **rypples.earth**. The tokens below were read from the live site's computed styles, and the shell was refined in the mockups (canvas "The Rypples Platform: Design & Functionality Mockups"). If this document and the mockups disagree, this document wins.

## 1. Tokens

Define these as CSS custom properties in `app/globals.css`, and expose them to Tailwind v4 through `@theme`. Components use the tokens only, never literal hex values.

```css
@theme {
  /* Ocean */
  --color-abyss: #001A24;          /* app background, behind the sheet */
  --color-ocean: #002F40;          /* sheet / page surface */
  --color-panel: #1A3A47;          /* solid raised surface (menus, popovers) */
  --color-avatar: #3B4549;

  /* Lime */
  --color-lime: #ACCF09;
  --color-lime-bright: #C2E812;    /* eyebrows, gradient start, hover */
  --color-lime-15: rgb(172 207 9 / .15);
  --color-lime-10: rgb(172 207 9 / .10);
  --color-lime-30: rgb(172 207 9 / .30);

  /* Ink (text on ocean) */
  --color-ink: #FFFFFF;
  --color-ink-2: rgb(255 255 255 / .72);   /* body, secondary */
  --color-ink-3: rgb(255 255 255 / .56);   /* meta, captions */
  --color-ink-4: rgb(255 255 255 / .45);   /* nav labels only */

  /* Lines and surfaces */
  --color-line: rgb(255 255 255 / .06);
  --color-line-2: rgb(255 255 255 / .08);
  --color-surface: rgb(255 255 255 / .03);  /* tile fill */
  --color-surface-2: rgb(255 255 255 / .04);
  --color-well: rgb(0 26 36 / .55);         /* inputs, Ask Captain bar */

  /* Status (sparingly) */
  --color-amber: #E8B04A;          /* at risk, over benchmark, needs you */
  --color-neutral-dot: rgb(255 255 255 / .40);

  /* Paper (documents: board pack preview, shareholder update, schedule) */
  --color-paper: #F6F4EE;
  --color-paper-ink: #0F2730;

  --font-display: "Syne", sans-serif;
  --font-body: "Montserrat", sans-serif;

  --radius-btn: 8px;
  --radius-item: 10px;
  --radius-tile: 16px;
  --radius-pill: 20px;
  --radius-sheet: 28px;
  --radius-hero: 80px;             /* Welcome stacked panels only */

  --shadow-sheet: 0 -20px 50px 2px rgb(0 11 31 / .28);
  --shadow-btn: 0 4px 16px rgb(194 232 18 / .25);
}
```

Load fonts with `next/font/google`: Syne at weights 500/600/700 and Montserrat at 300/400/500/600, with `display: swap`.

## 2. Typography

| Role | Spec |
|---|---|
| Display H1 | Syne 500, 44px/1.04, letter-spacing −0.03em, ink. 32px at phone width |
| Heading rule | 60×3px lime bar, radius 2px, 14px below every H1 |
| Section H2 | Montserrat 600, 15px/1.3, ink |
| Eyebrow | Montserrat 500, 12px, uppercase, tracking 0.2em, lime-bright |
| Lede | Montserrat 300, 18px/1.6, ink-2, max 760px |
| Body | Montserrat 400, 14px/1.6, ink-2 |
| Meta | Montserrat 500, 12px/1.4, ink-3 |
| Big number | Syne 500, 40px/1, −0.03em |
| Company name (cards) | Syne 700, 24px |
| Wordmark | The official Rypples logo (`public/brand/rypples-logo.svg`, white and light blue, 197 × 51, for dark grounds) via `RypplesLogo`, then a 1px line-2 divider and the product label ("OS" / "Engine") Montserrat 600 11px, tracking 0.2em, uppercase, lime |

Use sentence case everywhere except eyebrows and nav labels.

## 3. Shell

**Rypples OS layout:** abyss background. Left rail 232–256px. Stage on the right holds the **sheet**: ocean surface, radius 28px on the top corners, `--shadow-sheet`, 12px inset from the top and right.

- **Rail:**
  - The Rypples logo and product label (the wordmark row in §2).
  - Nav items: Home (with a count badge for open decisions), Portfolio, Playbook, Operating partners, Founder programs, Pipeline, Investor relations.
  - A "Board seats" section listing companies where Rypples holds a seat, each showing the next board day.
  - Profile block at the bottom (avatar, name, title). It links to the other product.
  - Nav item style: 9×12px padding, radius 10px. Active state is lime-10 fill with a lime icon stroke. Icons are 18px line icons, 1.5px stroke, round caps.
- **Top bar (inside the sheet):**
  - Breadcrumb on the left.
  - **Ask Captain** bar on the right: a well background with a ship's-wheel icon in lime. Placeholder text is contextual ("Ask Captain about Desolenator"). Shows a `⌘K` badge. Clicking it, or pressing ⌘K or Ctrl+K, opens the Captain drawer.
- **Page:** padding 36px 40px 64px, vertical gap 32px.

**Rypples Engine layout:** the same shell, with these differences:

- The wordmark product label reads "Engine".
- Below the wordmark is a company block ("Desolenator · Ocean Health · Europe").
- Nav: Home, Board pack, Plant capital, How Rypples works.
- Profile shows the founder.
- In Engine, Ask Captain is founder-scoped (see `docs/07-ai.md` F3).

**Welcome:** a full-bleed abyss background with faint large arcs (radial circles at 2.5% white). The content sits on stacked panels with 80px top radius and the sheet shadow, mirroring the rypples.earth home page.

## 4. Components

Build these in `components/ui` (shadcn primitives restyled) and `components/rypples` (domain components). Each has a Storybook-free test page at `/dev/components`, which is excluded from production by `NODE_ENV`.

| Component | Spec |
|---|---|
| `Button` (primary) | Gradient 135deg lime-bright→lime, radius 8, padding 10×22, abyss text, Montserrat 600 14px, `--shadow-btn`. **At most one per screen.** |
| `Button` (outline) | surface fill, 1px lime-30 border, radius 8, padding 8×16, ink, 500 13px. Hover: border lime at 65%. Done state: lime-10 fill, lime text, check icon |
| `Pill` | lime-15 fill, lime-30 border, radius 20, 600 11px lime. Grey variant for neutral metadata. **Only for vertical, region and stage** |
| `Tile` | surface fill, 1px line-2 border, radius 16. The outline tile variant uses a lime-30 border with lime line icons (Welcome doors, program cards). Never nest a tile in a tile |
| `Eyebrow`, `H1` (with rule), `Lede`, `Meta` | as in §2 |
| `Illustrative` | wraps any illustrative value: 1px dotted bottom border at white 50%, tooltip "Illustrative figure". Required wherever `provenance = illustrative` |
| `SourceChip` | small outline link (meta size) with a source favicon-free label, e.g. "Republic deal note". Opens in a new tab. Record chips (internal) link to the route |
| `Tabs` (`ftab`) | rypples.earth filter-tab style: uppercase 12px tracked labels, active state = ink plus a 2px lime underline. URL-synced via a `?tab=` search param |
| `SegmentedFilter` | labelled single-choice filter: eyebrow label over a `well` track (10px radius, 3px inset) of segments, "All" first, each with a count; active segment = lime-10 fill, lime text; segments with no matches are disabled. Used on Operating partners inside a `surface` filter bar with "Showing X of Y · Clear filters" |
| `ScoreBar` | five 6px segments. Lime when it's the binding domain, ink-2 otherwise, off = white 10%. Score 0 or null renders "Evidence gap" in ink-3 italic |
| `DaysBar` | track to 1.5× benchmark. A white tick marks the benchmark. Fill is lime for the focus company, amber over benchmark, white 50% otherwise. Label "39 of 120 days · outside ref" |
| `StatusDot` | 7px dot: lime = done/ready, amber = at risk or needs you, white 40% = open or not started |
| `DecisionRow` | grid 120px / 1fr / auto: context label, question and line, action |
| `LedgerRow` | commitment, from, due, status dot, and a five-step rating control once delivered |
| `ProgressSteps` | vertical list of steps (waiting / running / done) for streamed AI flows. Running shows a 1.5px lime arc spinner, not a skeleton shimmer |
| `Drawer` | right drawer, width min(600px, 100vw), ocean surface, left border line, scrim at abyss 55% |
| `Paper` | document surface for board pack preview, shareholder update and schedule. Paper background, paper ink, Montserrat 300 body, Syne headings, max 720px, print-ready |
| `DotGrid` | the 100-company grid on Home: 10×10, 10px dots, 6px gap. `compact` variant for the Home summary strip: 20×5, 6px dots, 3px gap. Lime = active public, lime at 45% = active not announced, lime ring = exit, white 8% = future |
| `MarketMap` | SVG choropleth (see `docs/09-geodata.md` §5) |
| `LearningCurve` | chart (see `docs/06-screens.md` S9). Use the dataviz conventions in §7 |
| `RippleCanvas` | the WebGL ripple (§9) |

## 5. Layout and density

- 12-column fluid grid inside `.page`, with 24px gutters. Most screens use two columns (8/4) above 1200px and one column below.
- Tables: 14px rows, 18px vertical padding, rows separated by line-2. No zebra striping, and no row cards inside tables.
- Keep content width to about 1180px inside the sheet on very wide screens.

## 6. Motion

Use Framer Motion only for:

- the drawer slide (220ms, ease-out);
- streamed AI content entering (opacity 0→1 and translateY 8→0, 200ms, staggered 60ms);
- the tab underline (layoutId).

There are no looping or decorative animations, no parallax and no hover lifts. `prefers-reduced-motion: reduce` disables all transforms; content still appears.

## 7. Charts

Charts are hand-built SVG or d3 scales rendered with React. There is no chart library chrome.

- Axes in ink-3 at 12px. Gridlines at white 6%, horizontal only.
- One highlight series in lime. Comparison series in white 50%. Benchmarks as dashed white 40% lines with a direct label.
- Direct labels instead of legends wherever possible. Tooltips are a panel surface at 12px.
- Illustrative data series carry an "Illustrative" caption under the chart.

## 8. Imagery

- People are shown as circular, grayscale portraits (as on rypples.earth) or monogram placeholders. Photo slots: `public/people/{jerome,adri}.jpg`. If a file is missing, the monogram renders.
- The official logo and favicon live in `public/brand/` (`rypples-logo.svg`, `favicon.png`, both from rypples.earth). The logo is only placed on dark grounds.
- There are no stock photos, gradients behind text, or glow effects.

## 9. The ripple (the one brand moment)

rypples.earth uses a WebGL water ripple. The platform uses one, in exactly one place: when a lesson is **sent** from the Playbook (S6).

- `RippleCanvas` is an absolutely positioned canvas over the "Who it travels to" panel and the matched-company list.
- Implement it as a small custom WebGL height-field simulation (two ping-pong textures, damping 0.985) in about 150 lines. Do not use jQuery.
- On send, drop one impulse at the lesson card's anchor. The wave crosses the panel in about 1.2s. As the front reaches each recipient row, that row's status dot turns lime and its label changes to "Sent".
- The tint is lime at 12% over transparent, so the canvas never obscures text.
- The canvas exists only while animating. Unmount it after 1.6s.
- **Reduced motion or no WebGL:** skip the canvas. Rows update in order with a 120ms stagger.

## 10. Phone width (≤ 640px)

- The rail becomes a top bar: mark, product label, a menu button that opens the nav as a sheet, and the Captain button. The profile block moves to the bottom of the nav sheet.
- The sheet loses its side inset. Radius 20px at the top.
- Two-column layouts stack. Tables become stacked rows: primary cell first, then a meta line. Never scroll tables horizontally, except the Pipeline board, which becomes a stage selector (segmented control) with one column visible.
- The Captain drawer becomes full-screen.
- H1 32px. Page padding 20px.
- Test widths: 390×844 and 360×800 (`docs/11-testing-and-evals.md`).

## 11. Accessibility

- Contrast: body text uses ink-2 or ink on ocean. Ink-3 only for meta text 12px and above. Verify AA with axe in end-to-end tests.
- Focus: 2px lime outline, 2px offset, on every interactive element.
- Drag in Pipeline has a keyboard and button alternative ("Mark as led").
- The rating control is a radio group. Status dots always have a text label next to them, so colour is never the only signal.
- Streaming regions use `aria-live="polite"`.

## 12. Design constraints (to avoid generic AI-generated UI)

- No gradient washes, glows, glassmorphism, blurred blobs or animated backgrounds.
- One primary button per screen. Everything else is outline or a text link.
- Pills only for vertical, region and stage. Never for status, counts or tags.
- No "AI" sparkle icons. Captain's mark is the ship's wheel.
- No slogan headlines. H1s state what the screen is or what's true ("Thirteen backed. One constraint each." is the ceiling for flourish).
- No emoji, no exclamation marks, no badges saying "New" or "Beta".
- No nested cards. No more than one tile per section.
- Numbers come from data and carry provenance. Never pad a layout with placeholder statistics.
