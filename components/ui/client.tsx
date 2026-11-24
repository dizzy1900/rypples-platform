"use client";
/** Client primitives: URL-synced tabs, drawer, modal, popover, copy, progress steps. */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconClose, IconCopy } from "./icons";

// ── Tabs (rypples.earth filter-tab style, ?tab= synced) ─────────────────
export function UrlTabs({
  tabs,
  param = "tab",
  current,
  label,
}: {
  tabs: { key: string; label: ReactNode }[];
  param?: string;
  current: string;
  label: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const id = stableId("tabs", param, label);
  const reduce = useReducedMotion();
  const href = (k: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set(param, k);
    return `${pathname}?${q.toString()}`;
  };
  return (
    <nav aria-label={label} className="no-print -mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-6 border-b border-line-2 px-1">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key} className="relative">
              <Link
                href={href(t.key)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "block pb-3 pt-1 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors",
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {t.label}
              </Link>
              {active && (
                <motion.span
                  layoutId={reduce ? undefined : `tab-underline-${id}-${param}`}
                  className="absolute inset-x-0 -bottom-px h-[2px] bg-lime"
                  transition={{ duration: 0.2 }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Local (non-URL) segmented tabs, e.g. chips. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: ReactNode }[];
  value: T | null;
  onChange: (v: T | null) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : o.key)}
            className={clsx(
              "rounded-btn border px-3 py-1.5 text-[12px] font-medium transition-colors",
              active ? "border-lime bg-lime-10 text-lime" : "border-line-2 bg-surface text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled single-choice filter: "All" plus each option, with a count per segment. */
export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  total,
}: {
  label: string;
  options: { key: T; label: ReactNode; count: number }[];
  value: T | null;
  onChange: (v: T | null) => void;
  total: number;
}) {
  const all: { key: T | null; label: ReactNode; count: number }[] = [{ key: null, label: "All", count: total }, ...options];
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="eyebrow text-ink-3">{label}</span>
      <div
        role="group"
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="flex max-w-full overflow-x-auto rounded-item border border-line-2 bg-well p-[3px]"
      >
        {all.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.key)}
              disabled={!active && o.count === 0}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn px-3 py-1.5 text-[12px] font-medium transition-colors",
                active ? "bg-lime-10 text-lime" : "text-ink-2 hover:text-ink disabled:text-ink-3 disabled:opacity-60",
              )}
            >
              {o.label}
              <span className={clsx("tabular-nums", active ? "text-lime" : "text-ink-3")}>{o.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Focus trap helper ───────────────────────────────────────────────────
function useFocusTrap(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])') ?? [],
      );
    const t = setTimeout(() => {
      const auto = el?.querySelector<HTMLElement>("[data-autofocus]");
      (auto ?? focusables()[0])?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, ref, onClose]);
}

// ── Drawer (right, min(600px,100vw)) ────────────────────────────────────
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 600,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useFocusTrap(open, ref, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className="absolute inset-0 bg-[rgb(0_26_36/0.55)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-y-0 right-0 flex flex-col border-l border-line-2 bg-ocean max-sm:w-screen"
            style={{ width: `min(${width}px, 100vw)` }}
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DrawerHeader({ title, meta, onClose, icon }: { title: ReactNode; meta?: ReactNode; onClose: () => void; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-2 px-6 py-5">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 text-lime">{icon}</span>}
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
          {meta && <p className="meta">{meta}</p>}
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-btn p-1.5 text-ink-2 hover:text-ink">
        <IconClose />
      </button>
    </div>
  );
}

/** A side sheet: same mechanics as the drawer with a header and scroll body. */
export function Sheet({
  open,
  onClose,
  title,
  meta,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title} width={width}>
      <DrawerHeader title={title} meta={meta} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      {footer && <div className="border-t border-line-2 px-6 py-4">{footer}</div>}
    </Drawer>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-[rgb(0_26_36/0.7)]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-tile border border-line-2 bg-panel"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <h2 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-btn p-1.5 text-ink-2 hover:text-ink">
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 px-6 pb-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

// ── Popover (click to open, Esc/outside to close) ───────────────────────
export function Popover({
  trigger,
  children,
  label,
  align = "left",
}: {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = stableId("pop", label);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="text-left"
      >
        {trigger}
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={label}
          className={clsx(
            "absolute z-40 mt-2 block w-[min(360px,80vw)] rounded-item border border-line-2 bg-panel p-4 text-[12px] leading-[1.5] text-ink-2 shadow-[var(--shadow-sheet)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}

// ── Copy ────────────────────────────────────────────────────────────────
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked: leave the text selectable */
        }
      }}
      className={clsx("inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink", className)}
      aria-label={done ? "Copied" : label}
    >
      {done ? <IconCheck size={14} /> : <IconCopy size={14} />}
      <span>{done ? "Copied" : label}</span>
    </button>
  );
}

// ── Progress steps for streamed flows ───────────────────────────────────
export type StepState = "waiting" | "running" | "done";
export function ProgressSteps({ steps }: { steps: { key: string; label: ReactNode; state: StepState; detail?: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-3" aria-live="polite">
      {steps.map((s) => (
        <li key={s.key} className="flex items-start gap-3">
          <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center">
            {s.state === "done" ? (
              <IconCheck size={16} className="text-lime" />
            ) : s.state === "running" ? (
              <span className="block h-[14px] w-[14px] animate-spin rounded-full border-[1.5px] border-off border-t-lime" aria-label="Running" />
            ) : (
              <span className="block h-[7px] w-[7px] rounded-full bg-neutral-dot" />
            )}
          </span>
          <span className="flex flex-col">
            <span className={clsx("text-[14px]", s.state === "waiting" ? "text-ink-3" : "text-ink")}>{s.label}</span>
            {s.detail && <span className="meta">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Captain opener context (drawer host lives in the shell) ─────────────
type CaptainCtx = { open: (prefill?: string) => void };
export const CaptainContext = createContext<CaptainCtx>({ open: () => {} });
export const useCaptain = () => useContext(CaptainContext);

export function OpenCaptainButton({ prefill, children, className }: { prefill?: string; children: ReactNode; className?: string }) {
  const { open } = useCaptain();
  return (
    <button type="button" onClick={() => open(prefill)} className={clsx("text-link text-[13px]", className)}>
      {children}
    </button>
  );
}

/** Stream-in wrapper: opacity 0→1, y 8→0, 200ms. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  );
}

export function useRefreshAfter() {
  const router = useRouter();
  return useCallback(() => router.refresh(), [router]);
}

/**
 * Deterministic DOM id from props. Used instead of React useId, whose values diverged
 * between server and client under the Next dev segment wrappers (hydration mismatch).
 */
export function stableId(...parts: (string | number)[]) {
  return (
    "r-" +
    parts
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
