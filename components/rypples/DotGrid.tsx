import clsx from "clsx";

export type Dot = { id: string; label: string; kind: "active" | "unannounced" | "exit"; added?: boolean };

/** 10×10 grid, 10px dots, 6px gap (docs/02-design-system.md §4). `compact`: 20×5, 6px dots, 3px gap, for a summary strip. */
export function DotGrid({ dots, total = 100, compact = false }: { dots: Dot[]; total?: number; compact?: boolean }) {
  const cells = Array.from({ length: total }, (_, i) => dots[i] ?? null);
  return (
    <div
      role="img"
      aria-label={`${dots.length} of ${total} companies backed`}
      className={clsx("grid w-max", compact ? "grid-cols-20 gap-[3px]" : "grid-cols-10 gap-[6px]")}
    >
      {cells.map((d, i) => (
        <span
          key={i}
          title={d?.label}
          className={clsx(
            "block rounded-full",
            compact ? "h-[6px] w-[6px]" : "h-[10px] w-[10px]",
            !d && "bg-[rgb(255_255_255/0.08)]",
            d?.kind === "active" && "bg-lime",
            d?.kind === "unannounced" && "bg-[rgb(172_207_9/0.45)]",
            d?.kind === "exit" && (compact ? "border border-lime bg-transparent" : "border-[1.5px] border-lime bg-transparent"),
          )}
        />
      ))}
    </div>
  );
}
