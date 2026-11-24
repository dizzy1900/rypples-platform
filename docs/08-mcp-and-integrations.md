# 08 · Tool registry, MCP server and integrations

The principle: the platform brings data together from best-in-class tools, and exposes its own capabilities so other tools, including the user's own Claude, can use them. One tool registry serves both directions.

## 1. Tool registry (`lib/tools/registry.ts`)

```ts
type ToolDef<I, O> = {
  name: string;                       // snake_case, stable
  title: string;                      // human label for /connect and UI
  description: string;                // written for a model: when to use, what it returns
  input: z.ZodType<I>;
  scopes: ("rypples" | "founder" | "public")[];
  readOnly: boolean;
  handler: (ctx: { viewer: Viewer | PublicViewer; sessionId?: string }, input: I)
           => Promise<{ data: O; refs: Ref[] }>;
};
type Ref = { type: string; id: string; label: string; href?: string; url?: string; provenance: Provenance };
```

- Every handler reads through repositories and projections. Scope is enforced inside the handler, not only by filtering the tool list.
- Every result includes `refs`. Captain uses them for chips. MCP returns them as part of the structured content.
- Results carry provenance, confidence and `source_kind` wherever relevant, so callers can caveat.

### Tools

| Tool | Input | Returns | Scopes |
|---|---|---|---|
| `list_portfolio` | `{ vertical? }` | companies: name, tagline, vertical, region, stage, constraint, days open, benchmark, over-benchmark flag, rating | rypples, public |
| `portfolio_stats` | `{}` | stuck by constraint, over benchmark, backed/active/exit counts, firm rating | rypples, public |
| `get_company` | `{ slug }` | profile (public facts with sources), current constraint, lifecycle (anchors), next board | rypples, public. Founder: own company only |
| `get_diagnostic` | `{ slug }` | latest confirmed or reviewed diagnostic: 8 scores, findings, evidence (url, `cited_text`) | rypples, public. Founder: own |
| `get_benchmarks` | `{ domain? }` | days, source kind, Rypples cases of 8, confidence | rypples, public |
| `search_playbook` | `{ query?, domain? }` | approved and proposed lessons (status flagged), library stats | rypples, public. Founder: lessons sent to them |
| `get_lesson` | `{ id }` | title, play, timeline with sources, matches | rypples, public. Founder: if sent |
| `get_operating_partners` | `{}` | catalogue, firm capacity, operators by type, stage and load (board-level partners outside the hours pool) | rypples, public. Founder: catalogue only |
| `get_allocation` | `{ slug }` | allocation, enrolments, hours used | rypples. Founder: own |
| `get_ledger` | `{ slug }` | commitments, statuses, ratings | rypples. Founder: own |
| `list_pipeline` | `{}` | codename deals by stage, proposed constraints | rypples, public |
| `get_market_evidence` | `{ slug, weights? }` | ranked markets with indicator values and sources | rypples, public. Founder: own |
| `get_impact` | `{}` | Ocean Impact Navigator status per company | rypples, public |
| `get_strategic_paths` | `{ slug? }` | relationships today and likely buyers | rypples, public. Founder: own |
| `list_decisions` | `{}` | open decisions for Jerome | rypples |
| `get_board_pack_status` | `{ slug }` | section states (never financial values) | rypples. Founder: own |
| `propose_next_step` | `{ title, detail, target }` | created proposal ID | rypples, founder (write; **not** public) |

**PublicViewer** (MCP) reads seed data and reviewed precomputed outputs only. It never reads session overlays, Captain messages or any `session_id` rows.

## 2. Captain's use

`lib/ai/flows/captain.ts` filters the registry by viewer scope and converts entries to Anthropic tool definitions:

- `name`
- `description`
- `input_schema` from `z.toJSONSchema(input)`
- `strict: true`

It executes `tool_use` blocks in-process against the same handlers. Founder-scoped Captain gets only tools whose scopes include `founder`, and the handlers enforce `company_id = viewer.companyId`.

## 3. Public MCP server (`app/api/mcp/route.ts`)

- Transport: Streamable HTTP, **stateless** (no MCP session IDs), at `/api/mcp`. Use `@modelcontextprotocol/sdk`'s `McpServer` with the Streamable HTTP server transport, or Vercel's `mcp-handler` adapter, which wraps the same SDK for Next.js route handlers.
- Registers every registry tool whose scopes include `public` and `readOnly === true`. Tool annotations: `readOnlyHint: true`, `openWorldHint: false`.
- Each tool returns:
  - `structuredContent`: `{ data, refs }`;
  - a concise text rendering for clients that ignore structured content;
  - absolute `href` links back to the prototype.
- Server instructions (sent on initialise): "Read-only access to the Rypples Platform prototype's demo data: the public ocean portfolio, scenario and illustrative figures (flagged by `provenance`). Caveat outside benchmarks and low-confidence values."
- **Auth:** none. The data is public or illustrative. Rate-limit by IP (`docs/10-security-cost-ops.md`). Reject request bodies over 64 KB.
- CORS: allow `POST` and `GET` from any origin for MCP clients. Disallow credentials.
- **Verification:** the release checklist requires a passing session in the MCP Inspector, plus a Claude Code session using `claude mcp add --transport http rypples <url>`, asking the four example questions from `/connect`.

**Production path:** the same registry behind OAuth with real `Viewer` claims, so a partner's or founder's own Claude sees exactly what their role allows.

## 4. Integration adapters (`lib/integrations`)

The platform does not store documents, run a CRM or record meetings. It connects to the tools that do. Each kind of system has an interface, and the prototype ships demo adapters with fixtures.

```ts
interface DocumentStore {       // Drive, SharePoint, data rooms
  listFolder(companyId): Promise<DocRef[]>;            // names, types, modified dates, external URLs
  getText(docRef): Promise<{ text: string; url: string }>;
}
interface Crm {                 // deal and contact system of record
  listDeals(): Promise<DealRef[]>;
  getDeal(id): Promise<DealDetail>;
}
interface MeetingNotes {        // notes and transcripts tool
  listSince(date): Promise<SessionNote[]>;             // kind, title, who, held_at, confidential flag
  getThemes(id): Promise<string[]>;                    // circles: themes only, never raw notes
}
interface FinanceSystem {       // founder's accounting/FP&A tool
  getKpis(companyId): Promise<{ key: string; value: string; asOf: string }[]>;
}
```

- `lib/integrations/demo/*` implements each one from `data/seed/integrations/*.json`. Every result carries `source: { system: "Drive" | "CRM" | ..., demo: true }`, and the UI shows "Demo connection" wherever such data appears (data room sheet, intake sessions, Financials section).
- The FinanceSystem demo returns masked values (`••••`) with real `asOf` dates. No Desolenator financials exist anywhere in the repo.
- The **Connected strip** in Captain reads adapter registrations (`name`, `demo`, `status`) from a single `integrations` config, not a hardcoded list.
- **Production path:** implement each interface as an MCP client to the vendor's MCP server, or as an API adapter. Callers don't change. Meeting-notes ingestion then triggers the Playbook intake flow on new sessions (event-driven, not scheduled).
