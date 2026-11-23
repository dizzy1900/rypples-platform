/**
 * Server-safe primitives (docs/02-design-system.md §4). Token classes only, never hex.
 * Client primitives live in components/ui/client.tsx.
 */
import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { Provenance } from "@/lib/domain/schemas";
import { IconCheck, IconExternal } from "./icons";

export { clsx as cx };

// ── Typography ─────────────────────────────────────────────────────────
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("eyebrow", className)}>{children}</p>;
}

export function H1({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h1 className="h1">{children}</h1>
      <span className="h1-rule" aria-hidden />
    </div>
  );
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("lede", className)}>{children}</p>;
}

export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("meta", className)}>{children}</p>;
}

export function H2({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={clsx("h2", className)}>
      {children}
    </h2>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <H1>{title}</H1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {lede && <Lede>{lede}</Lede>}
      {children}
    </header>
  );
}

export function Section({
  title,
  meta,
  aside,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={clsx("flex flex-col gap-4", className)} aria-labelledby={id ? `${id}-h` : undefined}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && <H2 id={id ? `${id}-h` : undefined}>{title}</H2>}
            {meta && <Meta>{meta}</Meta>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────
const primaryCls =
  "inline-flex items-center justify-center gap-2 rounded-btn px-[22px] py-[10px] text-[14px] font-semibold text-abyss shadow-[var(--shadow-btn)] bg-[linear-gradient(135deg,var(--color-lime-bright),var(--color-lime))] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-opacity";
const outlineCls =
  "inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-[13px] font-medium text-ink bg-surface border border-lime-30 hover:border-[rgb(172_207_9/0.65)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const doneCls =
  "inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-[13px] font-medium text-lime bg-lime-10 border border-lime-30";
const textCls = "inline-flex items-center gap-1 text-[13px] font-medium text-lime hover:text-lime-bright disabled:opacity-40";

export type ButtonVariant = "primary" | "outline" | "done" | "text";
export const buttonClass = (v: ButtonVariant = "outline", className?: string) =>
  clsx(v === "primary" ? primaryCls : v === "done" ? doneCls : v === "text" ? textCls : outlineCls, className);

export function Button({
  variant = "outline",
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...rest}>
      {variant === "done" && <IconCheck size={14} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "outline",
  className,
  children,
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; variant?: ButtonVariant }) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {children}
    </Link>
  );
}

export function TextLink({ href, children, className, external }: { href: string; children: ReactNode; className?: string; external?: boolean }) {
  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={clsx("text-link", className)}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={clsx("text-link", className)}>
      {children}
    </Link>
  );
}

// ── Pills (only vertical, region, stage) ────────────────────────────────
export function Pill({ children, grey }: { children: ReactNode; grey?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-pill border px-2.5 py-[3px] text-[11px] font-semibold",
        grey ? "border-line-2 bg-surface-2 text-ink-2" : "border-lime-30 bg-lime-15 text-lime",
      )}
    >
      {children}
    </span>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────
export function Tile({
  children,
  className,
  outline,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  outline?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return <As className={clsx(outline ? "tile-outline" : "tile", "p-6", className)}>{children}</As>;
}

export function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "paper mx-auto w-full max-w-[720px] rounded-tile bg-paper p-8 text-paper-ink sm:p-12 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display",
        "font-light leading-[1.65]",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Provenance ──────────────────────────────────────────────────────────
/** Wraps any illustrative value: dotted underline, tooltip "Illustrative figure". */
export function Illustrative({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <span className="ill" title={note ? `Illustrative figure. ${note}` : "Illustrative figure"} tabIndex={0}>
      {children}
    </span>
  );
}

/** Render a value with the marker its provenance requires. */
export function Prov({ p, children, note }: { p: Provenance; children: ReactNode; note?: string }) {
  if (p === "illustrative") return <Illustrative note={note}>{children}</Illustrative>;
  return <>{children}</>;
}

export function SourceChip({ href, label, title }: { href: string; label: string; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? href}
      className="inline-flex items-center gap-1 rounded-btn border border-line-2 bg-surface px-2 py-[2px] text-[12px] font-medium text-ink-2 hover:border-lime-30 hover:text-ink"
    >
      {label}
      <IconExternal size={11} />
    </a>
  );
}

export function RecordChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-btn border border-lime-30 bg-surface px-2 py-[2px] text-[12px] font-medium text-ink-2 hover:text-ink"
    >
      {label}
    </Link>
  );
}

export function GeneratedLabel({ status = "proposed", extra }: { status?: "proposed" | "approved" | "confirmed"; extra?: ReactNode }) {
  return (
    <p className="meta">
      {status === "proposed" ? "Proposed · drafted by Captain" : status === "approved" ? "Approved" : "Confirmed"}
      {extra && <> · {extra}</>}
    </p>
  );
}

// ── Status ──────────────────────────────────────────────────────────────
export type DotTone = "lime" | "amber" | "neutral";
export function StatusDot({ tone, label, className }: { tone: DotTone; label: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 text-[13px] text-ink-2", className)}>
      <span
        aria-hidden
        className={clsx(
          "inline-block h-[7px] w-[7px] shrink-0 rounded-full",
          tone === "lime" ? "bg-lime" : tone === "amber" ? "bg-amber" : "bg-neutral-dot",
        )}
      />
      <span>{label}</span>
    </span>
  );
}

/** Five 6px segments. Lime when binding, ink-2 otherwise. Null → "Evidence gap". */
export function ScoreBar({ score, binding, label }: { score: number | null; binding?: boolean; label?: string }) {
  if (score == null || score === 0)
    return <span className="text-[13px] italic text-ink-3">Evidence gap</span>;
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${label ? label + ": " : ""}score ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={clsx("h-[6px] w-[18px] rounded-[2px]", i <= score ? (binding ? "bg-lime" : "bg-ink-2") : "bg-off")}
        />
      ))}
    </span>
  );
}

/** Track to 1.5× benchmark, white tick at the benchmark. */
export function DaysBar({
  days,
  benchmark,
  focus,
  label,
}: {
  days: number;
  benchmark: number;
  focus?: boolean;
  label?: ReactNode;
}) {
  const max = benchmark * 1.5;
  const pct = Math.min(100, (days / max) * 100);
  const tick = (benchmark / max) * 100;
  const over = days > benchmark;
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <div className="relative h-[6px] w-full rounded-full bg-off" aria-hidden>
        <div
          className={clsx("absolute inset-y-0 left-0 rounded-full", focus ? "bg-lime" : over ? "bg-amber" : "bg-[rgb(255_255_255/0.5)]")}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute -top-[3px] h-[12px] w-[2px] bg-ink" style={{ left: `calc(${tick}% - 1px)` }} />
      </div>
      {label && <span className="meta">{label}</span>}
    </div>
  );
}

export function Monogram({ initials, size = 36, photo }: { initials: string; size?: number; photo?: string | null }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-avatar font-semibold text-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover grayscale" />
      ) : (
        initials
      )}
    </span>
  );
}

export function StatBlock({ value, label, className }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <span className="big-number">{value}</span>
      <span className="meta">{label}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-[14px] text-ink-3">{children}</p>;
}

/** A simple table that stacks at phone width. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("w-full", className)}>
      <table className="w-full border-collapse text-left text-[14px] max-sm:block [&_tbody]:max-sm:block [&_thead]:max-sm:hidden [&_tr]:max-sm:block [&_tr]:max-sm:py-3 [&_td]:max-sm:block [&_td]:max-sm:border-0 [&_td]:max-sm:py-0.5">
        {children}
      </table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx("border-b border-line-2 py-3 pr-4 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3", className)}>
      {children}
    </th>
  );
}
/** `label` repeats the column header above the value at phone width, where the thead is hidden. */
export function Td({ children, className, label }: { children?: ReactNode; className?: string; label?: string }) {
  return (
    <td
      data-label={label}
      className={clsx(
        "border-b border-line-2 py-[18px] pr-4 align-top text-ink-2",
        label && "max-sm:before:block max-sm:before:pt-1.5 max-sm:before:text-[11px] max-sm:before:font-medium max-sm:before:uppercase max-sm:before:tracking-[0.12em] max-sm:before:text-ink-4 max-sm:before:content-[attr(data-label)]",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** grid 120px / 1fr / auto */
export function DecisionRow({
  context,
  question,
  line,
  action,
}: {
  context: ReactNode;
  question: ReactNode;
  line: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-line-2 py-4 last:border-b-0 sm:grid-cols-[120px_1fr_auto] sm:items-baseline sm:gap-5">
      <span className="meta uppercase tracking-[0.12em]">{context}</span>
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-medium text-ink">{question}</span>
        <span className="text-[13px] text-ink-3">{line}</span>
      </div>
      <div>{action}</div>
    </div>
  );
}

export function Kv({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="meta">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}

/** The official Rypples logo (public/brand/rypples-logo.svg, white and light blue, for dark grounds). 197 × 51 intrinsic. */
export function RypplesLogo({ height = 28, className }: { height?: number; className?: string }) {
  const width = Math.round((height * 197) / 51);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/rypples-logo.svg" alt="Rypples" width={width} height={height} className={clsx("block shrink-0", className)} />
  );
}
