"use client";
/**
 * Allowlist markdown for Captain answers (docs/10 §5): paragraphs, - and 1. lists, **bold**, *emphasis*,
 * [text](url) links. Everything renders as React text nodes; raw HTML is never parsed.
 * Numbers listed in `untraced` get an amber underline with "Not traced to a record".
 */
import Link from "next/link";
import type { ReactNode } from "react";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function toRelative(href: string): string | null {
  if (href.startsWith("/")) return href;
  try {
    const u = new URL(href);
    const site = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
    const here = typeof window !== "undefined" ? window.location.host : null;
    if (u.host === site || u.host === here || u.hostname === "localhost") return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    /* not a URL */
  }
  return null;
}

function safeExternal(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function untracedNodes(text: string, untraced: string[], key: string): ReactNode[] {
  const list = [...new Set(untraced.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!list.length) return [text];
  const re = new RegExp(`(?<![\\d.,])(${list.map(esc).join("|")})(?![\\d])`, "g");
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    out.push(
      <span key={`${key}-u${i++}`} className="untraced" title="Not traced to a record" tabIndex={0}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function inline(text: string, untraced: string[], key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(...untracedNodes(text.slice(last, idx), untraced, `${key}-${i}t`));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const label = lm?.[1] ?? tok;
      const href = lm?.[2] ?? "";
      const rel = toRelative(href);
      const ext = rel ? null : safeExternal(href);
      if (rel)
        out.push(
          <Link key={k} href={rel} className="text-link">
            {label}
          </Link>,
        );
      else if (ext)
        out.push(
          <a key={k} href={ext} target="_blank" rel="noopener noreferrer" className="text-link">
            {label}
          </a>,
        );
      else out.push(label);
    } else if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold text-ink">{untracedNodes(tok.slice(2, -2), untraced, k)}</strong>);
    else out.push(<em key={k}>{untracedNodes(tok.slice(1, -1), untraced, k)}</em>);
    last = idx + tok.length;
  }
  if (last < text.length) out.push(...untracedNodes(text.slice(last), untraced, `${key}-end`));
  return out;
}

export function CaptainMarkdown({ text, untraced = [] }: { text: string; untraced?: string[] }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-3 text-[14px] leading-[1.6] text-ink-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const bullets = lines.every((l) => /^\s*[-*]\s+/.test(l));
        const numbers = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullets)
          return (
            <ul key={bi} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), untraced, `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        if (numbers)
          return (
            <ol key={bi} className="flex list-decimal flex-col gap-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), untraced, `${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {inline(l, untraced, `${bi}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Hide ⟦ref:…⟧ markers (and a trailing partial one) while tokens stream. */
export const stripMarkers = (t: string) => t.replace(/⟦[^⟧]*⟧/g, "").replace(/⟦[^⟧]*$/, "").replace(/[ \t]+([.,;:])/g, "$1");
