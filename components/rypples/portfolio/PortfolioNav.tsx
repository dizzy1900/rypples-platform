import Link from "next/link";
import clsx from "clsx";
import { VERTICALS, type PortfolioView } from "@/lib/data/projections/portfolio";

const href = (vertical: string | null, view: PortfolioView) => {
  const q = new URLSearchParams();
  if (vertical) q.set("vertical", vertical);
  if (view === "map") q.set("view", "map");
  const qs = q.toString();
  return `/os/portfolio${qs ? `?${qs}` : ""}`;
};

/** Vertical tabs and the Table / Constraint map toggle. Plain links, so state lives in the URL. */
export function PortfolioNav({ vertical, view }: { vertical: string | null; view: PortfolioView }) {
  const tabs = [{ key: null as string | null, label: "All" }, ...VERTICALS.map((v) => ({ key: v as string | null, label: v }))];
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Filter by vertical" className="-mx-1 overflow-x-auto">
        <ul className="flex min-w-max gap-6 border-b border-line-2 px-1">
          {tabs.map((t) => {
            const active = t.key === vertical;
            return (
              <li key={t.label} className="relative">
                <Link
                  href={href(t.key, view)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "block pb-3 pt-1 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors",
                    active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {t.label}
                </Link>
                {active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-lime" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </nav>
      <div role="group" aria-label="View" className="inline-flex w-fit overflow-hidden rounded-btn border border-line-2">
        {(["table", "map"] as const).map((v) => (
          <Link
            key={v}
            href={href(vertical, v)}
            scroll={false}
            aria-current={view === v ? "page" : undefined}
            className={clsx(
              "px-4 py-2 text-[13px] font-medium",
              view === v ? "bg-lime-10 text-lime" : "bg-surface text-ink-2 hover:text-ink",
            )}
          >
            {v === "table" ? "Table" : "Constraint map"}
          </Link>
        ))}
      </div>
    </div>
  );
}
