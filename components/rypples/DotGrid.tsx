import clsx from "clsx";

export type Dot = { id: string; label: string; kind: "active" | "unannounced" | "exit"; added?: boolean };

/** 10×10 grid, 10px dots, 6px gap (docs/02-design-system.md §4). */
export function DotGrid({ dots, total = 100 }: { dots: Dot[]; total?: number }) {
  const cells = Array.from({ length: total }, (_, i) => dots[i] ?? null);
  return (
    <div
      role="img"
      aria-label={`${dots.length} of ${total} companies backed`}
      className="grid w-max grid-cols-10 gap-[6px]"
    >
      {cells.map((d, i) => (
        <span
          key={i}
          title={d?.label}
          className={clsx(
            "block h-[10px] w-[10px] rounded-full",
            !d && "bg-[rgb(255_255_255/0.08)]",
            d?.kind === "active" && "bg-lime",
            d?.kind === "unannounced" && "bg-[rgb(172_207_9/0.45)]",
            d?.kind === "exit" && "border-[1.5px] border-lime bg-transparent",
          )}
        />
      ))}
    </div>
  );
}
