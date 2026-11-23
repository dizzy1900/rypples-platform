import { describe, expect, it } from "vitest";
import { getSeed } from "@/lib/data/seed";
import { SeedFiles, type SeedFileName } from "@/lib/domain/schemas";

const seed = getSeed();
const names = Object.keys(SeedFiles) as SeedFileName[];

describe("seed", () => {
  it("every seed file parses", () => {
    for (const n of names) expect(Array.isArray(seed[n]), n).toBe(true);
  });

  it("public rows with a source_id field point at a real source", () => {
    const ids = new Set(seed.sources.map((s) => s.id));
    for (const n of names) {
      for (const row of seed[n] as Record<string, unknown>[]) {
        if (row.provenance === "public" && "source_id" in row) {
          expect(row.source_id, `${n}/${String(row.id)} source_id`).not.toBeNull();
          expect(ids.has(row.source_id as string), `${n}/${String(row.id)} -> ${String(row.source_id)}`).toBe(true);
        }
      }
    }
  });

  it("ids are unique per file", () => {
    for (const n of names) {
      const ids = (seed[n] as { id?: string }[]).map((r) => r.id).filter(Boolean);
      expect(new Set(ids).size, n).toBe(ids.length);
    }
  });

  it("cited evidence ids and source ids exist", () => {
    const ev = new Set(seed.evidence.map((e) => e.id));
    const src = new Set(seed.sources.map((s) => s.id));
    for (const d of seed.dimension_scores) {
      if (d.score !== null) expect(d.evidence_ids.length, d.id).toBeGreaterThan(0);
      d.evidence_ids.forEach((e) => expect(ev.has(e), e).toBe(true));
      d.source_ids.forEach((s) => expect(src.has(s), s).toBe(true));
    }
  });

  it("has 13 companies: 12 public and 1 unannounced", () => {
    expect(seed.companies).toHaveLength(13);
    expect(seed.companies.filter((c) => c.public)).toHaveLength(12);
    const un = seed.companies.filter((c) => !c.public);
    expect(un).toHaveLength(1);
    expect(un[0].status).toBe("unannounced");
    expect(seed.companies.filter((c) => c.status === "active")).toHaveLength(11);
    expect(seed.companies.filter((c) => c.status === "exited")).toHaveLength(1);
  });

  it("only desolenator is anchor with a board seat", () => {
    expect(seed.companies.filter((c) => c.anchor).map((c) => c.id)).toEqual(["desolenator"]);
    expect(seed.companies.filter((c) => c.board_seat).map((c) => c.id)).toEqual(["desolenator"]);
  });

  it("has 14 cleared cases with the §4 domain distribution", () => {
    expect(seed.cleared_cases).toHaveLength(14);
    const by: Record<string, number> = {};
    for (const c of seed.cleared_cases) by[c.domain_id] = (by[c.domain_id] ?? 0) + 1;
    expect(by).toEqual({ people: 5, operations: 3, impact: 3, commercial: 2, regulatory: 1 });
  });

  it("operator hours sum to 1180 of 1600", () => {
    expect(seed.operators.reduce((a, o) => a + o.hours_committed, 0)).toBe(1180);
    expect(seed.operators.reduce((a, o) => a + o.hours_quarter, 0)).toBe(1600);
  });

  it("stuck-by-constraint counts match the spec", () => {
    const active = new Set(seed.companies.filter((c) => c.status === "active").map((c) => c.id));
    const by: Record<string, number> = {};
    for (const c of seed.company_constraints) if (active.has(c.company_id)) by[c.domain_id] = (by[c.domain_id] ?? 0) + 1;
    expect(by).toEqual({ operations: 5, commercial: 4, financing: 2 });
  });

  it("running enrolments total 12 and match program counts", () => {
    const running = seed.enrolments.filter((e) => e.status === "running");
    expect(running).toHaveLength(12);
    for (const p of seed.programs) {
      expect(running.filter((e) => e.program_id === p.id).length, p.id).toBe(p.running);
    }
  });

  it("firm rating averages 4.4 over nine numeric company ratings", () => {
    const r = seed.companies.map((c) => c.rating_seed).filter((x): x is number => x !== null);
    expect(r).toHaveLength(9);
    expect(Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10).toBe(4.4);
  });

  it("evidence quotes are verbatim in the snapshots", async () => {
    const { readFileSync } = await import("node:fs");
    for (const e of seed.evidence) {
      const loc = e.location as { source_id: string; start: number; end: number };
      const body = readFileSync(`data/sources/${loc.source_id}.md`, "utf8").split("---\n").slice(2).join("---\n");
      expect(body.slice(loc.start, loc.end), e.id).toBe(e.cited_text);
    }
  });

  it("bench groups sum to 46 and Tern has diligence with operations lowest", () => {
    expect(seed.bench_groups.reduce((a, b) => a + b.n, 0)).toBe(46);
    const tern = seed.deals.find((d) => d.id === "tern")!;
    expect(tern.diligence!.scores).toHaveLength(8);
    const min = Math.min(...tern.diligence!.scores.map((s) => s.score ?? 9));
    expect(tern.diligence!.scores.find((s) => s.score === min)!.domain_id).toBe("operations");
  });
});
