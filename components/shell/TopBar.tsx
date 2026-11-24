"use client";
import Link from "next/link";
import { Fragment } from "react";
import { useCaptain } from "@/components/ui/client";
import { IconWheel } from "@/components/ui/icons";

export type Crumb = { label: string; href?: string };

/** Breadcrumb (real links) + the Ask Captain bar. Rendered at the top of every OS and Rypples Engine page. Home is the rail's first item, so it is not repeated here. */
export function TopBar({ crumbs, placeholder = "Ask Captain" }: { crumbs: Crumb[]; placeholder?: string }) {
  const { open } = useCaptain();
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-line px-10 py-4 max-sm:px-5">
      {crumbs.length > 0 ? (
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-2 text-[13px]">
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <li aria-hidden className="text-ink-4">/</li>}
              <li className={i === crumbs.length - 1 ? "text-ink" : "text-ink-3"}>
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href} className="hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                )}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>
      ) : (
        <span aria-hidden />
      )}
      <button
        type="button"
        onClick={() => open()}
        className="well flex w-[340px] max-w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] text-ink-3 hover:text-ink-2 max-sm:hidden"
        aria-label={`${placeholder} ⌘K`}
      >
        <IconWheel className="text-lime" />
        <span className="flex-1 truncate">{placeholder}</span>
        <kbd aria-hidden className="rounded-[5px] border border-line-2 px-1.5 py-[1px] font-sans text-[11px] text-ink-3">⌘K</kbd>
      </button>
    </div>
  );
}

/** Page body: padding 36/40/64, gap 32, max ~1180px. */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-8 px-10 pb-16 pt-9 max-sm:px-5 max-sm:pt-6">{children}</div>;
}
