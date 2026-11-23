/** Operator capacity and allocation checks (docs/04-data-model.md §3, docs/07-ai.md F7). */
import type { Enrolment, Operator, Program } from "./schemas";

export const ALLOCATION_LIMITS = { programs: 3, hours: 400, startsInFirst100: 2 } as const;

export function firmCapacity(operators: Operator[]) {
  const committed = operators.reduce((s, o) => s + o.hours_committed, 0);
  const total = operators.reduce((s, o) => s + o.hours_quarter, 0);
  return { committed, total, pct: total ? committed / total : 0 };
}

export const operatorLoad = (o: Operator) => (o.hours_quarter ? o.hours_committed / o.hours_quarter : 0);
export const hoursLeft = (o: Operator) => o.hours_quarter - o.hours_committed;

export function tightestOperator(operators: Operator[]) {
  return [...operators].sort((a, b) => operatorLoad(b) - operatorLoad(a))[0];
}

export const canTakeProgram = (o: Operator, programHours: number) => o.hours_committed + programHours <= o.hours_quarter;
export const hasFreeSeat = (o: Operator) => o.seats_total != null && (o.seats_used ?? 0) < o.seats_total;

export function boardPartnerFor(operators: Operator[], vertical: string | null) {
  return operators.find((o) => o.role_key === "board_partner" && o.vertical_focus === vertical) ?? null;
}

/** Allocation used: running, requested and done enrolments count; proposed ones don't. */
export function allocationUsed(enrolments: Enrolment[], companyId: string) {
  const counted = enrolments.filter(
    (e) => e.company_id === companyId && (e.status === "running" || e.status === "requested" || e.status === "done"),
  );
  return {
    programs: counted.length,
    hours: counted.filter((e) => e.status !== "requested").reduce((s, e) => s + e.hours, 0),
    requestedHours: counted.filter((e) => e.status === "requested").reduce((s, e) => s + e.hours, 0),
  };
}

export type AllocationDecision =
  | { program_id: string; operator_id: string; hours: number; start: true }
  | { program_id: string; operator_id: string | null; hours: number; start: false; reason: string };

/**
 * Walk candidate programs in priority order, starting those that pass capacity and
 * allocation checks, deferring the rest with a reason.
 */
export function allocate(
  candidates: string[],
  programs: Program[],
  operators: Operator[],
  limits: { programs: number; hours: number; startsInFirst100: number } = ALLOCATION_LIMITS,
): { decisions: AllocationDecision[]; hoursStarted: number } {
  const decisions: AllocationDecision[] = [];
  let started = 0;
  let hours = 0;
  const load = new Map(operators.map((o) => [o.id, o.hours_committed]));
  for (const pid of candidates) {
    const p = programs.find((x) => x.id === pid);
    if (!p) continue;
    const op = operators.find((o) => o.id === p.delivered_by_operator_id) ?? null;
    const opLeft = op ? op.hours_quarter - (load.get(op.id) ?? 0) : 0;
    let reason: string | null = null;
    if (!op) reason = `No operator delivers ${p.name} yet`;
    else if (opLeft < p.hours) reason = `the ${op.role} has ${opLeft} hours left this quarter`;
    else if (started >= limits.startsInFirst100) reason = "at most two programs start in the first 100 days";
    else if (started >= limits.programs) reason = "the allocation's three programs are used";
    else if (hours + p.hours > limits.hours) reason = "it would exceed the 400-hour allocation";
    if (reason) {
      decisions.push({ program_id: pid, operator_id: op?.id ?? null, hours: p.hours, start: false, reason });
    } else {
      decisions.push({ program_id: pid, operator_id: op!.id, hours: p.hours, start: true });
      load.set(op!.id, (load.get(op!.id) ?? 0) + p.hours);
      started++;
      hours += p.hours;
    }
  }
  return { decisions, hoursStarted: hours };
}
