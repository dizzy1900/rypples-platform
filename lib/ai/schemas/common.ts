/**
 * zod → JSON Schema for structured outputs and strict tools (docs/07-ai.md §2):
 * `additionalProperties: false`, every key required (optional keys become nullable),
 * and constraint keywords the API ignores are stripped (we re-validate with zod instead).
 */
import { z } from "zod";

const STRIP = new Set([
  "$schema", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
  "multipleOf", "pattern", "format", "minItems", "maxItems", "uniqueItems", "default", "examples",
  "minProperties", "maxProperties", "propertyNames", "$id", "title",
]);

type J = Record<string, unknown>;

function walk(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walk);
  if (!node || typeof node !== "object") return node;
  const n = node as J;
  const out: J = {};
  for (const [k, v] of Object.entries(n)) {
    if (STRIP.has(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      const props: J = {};
      for (const [pk, pv] of Object.entries(v as J)) props[pk] = walk(pv);
      out.properties = props;
    } else out[k] = walk(v);
  }
  if (out.type === "object" || out.properties) {
    const props = (out.properties ?? {}) as J;
    const required = new Set((n.required as string[] | undefined) ?? []);
    for (const k of Object.keys(props)) {
      if (!required.has(k)) {
        const p = props[k] as J;
        const alreadyNullable =
          (Array.isArray(p.anyOf) && (p.anyOf as J[]).some((x) => x.type === "null")) || p.type === "null";
        if (!alreadyNullable) props[k] = { anyOf: [p, { type: "null" }] };
      }
    }
    out.properties = props;
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input", unrepresentable: "any" }) as J;
  return walk(raw) as Record<string, unknown>;
}

/** Replace nulls with undefined (strict tools send null for omitted optional keys). */
export function nullsToUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(nullsToUndefined) as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== null) o[k] = nullsToUndefined(x);
    return o as T;
  }
  return v;
}

/** Lower-case the listed enum fields anywhere in the object (enums compare case-insensitively). */
export function lowerEnums(v: unknown, fields: string[]): unknown {
  if (Array.isArray(v)) return v.map((x) => lowerEnums(x, fields));
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = fields.includes(k) && typeof x === "string" ? x.toLowerCase().trim() : lowerEnums(x, fields);
    return o;
  }
  return v;
}

/** Strip control characters from every string in a parsed request body. */
export function cleanStrings<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") as T;
  if (Array.isArray(v)) return v.map(cleanStrings) as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = cleanStrings(x);
    return o as T;
  }
  return v;
}

export const Slug = z.enum(["commercial", "financing", "operations", "technology", "regulatory", "people", "ai", "impact"]);
