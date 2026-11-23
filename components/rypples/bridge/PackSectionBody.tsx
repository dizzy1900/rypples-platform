import type { ReactNode } from "react";
import type { PackSectionView } from "@/lib/data/projections/bridge";
import { Markdown } from "./Markdown";

/**
 * The body of one board pack section as printed on Paper: kicker, title, source note,
 * paragraphs (or saved markdown), rows. Used by the live preview and the print view.
 */
export function PackSectionBody({
  section,
  textOverride,
  draftLabel,
  placeholder,
  children,
}: {
  section: PackSectionView;
  /** markdown to show instead of the seeded paragraphs (saved or live-edited text) */
  textOverride?: string | null;
  draftLabel?: boolean;
  /** shown when the section still needs the founder and has no text */
  placeholder?: string | null;
  children?: ReactNode;
}) {
  const text = textOverride ?? section.content;
  const hasText = !!text && text.trim().length > 0;
  return (
    <article className="flex flex-col gap-4 text-[14px] text-paper-ink">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] opacity-70">{section.kicker}</p>
        <h2 className="text-[26px] font-medium leading-[1.15] tracking-[-0.02em]">{section.title}</h2>
        <p className="text-[12px] opacity-70">{section.sourceNote}</p>
        {draftLabel && <p className="text-[12px] font-medium">Draft · edit before sharing</p>}
      </header>
      {hasText ? (
        <Markdown text={text as string} />
      ) : section.key === "letter" && section.needs ? (
        <>
          {placeholder && <p className="italic opacity-70">{placeholder}</p>}
          {section.paragraphs.map((p, i) => (
            <p key={i} className="opacity-80">
              {p}
            </p>
          ))}
        </>
      ) : (
        section.paragraphs.map((p, i) => <p key={i}>{p}</p>)
      )}
      {section.rows.length > 0 && (
        <dl className="flex flex-col">
          {section.rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-1 border-t border-[rgb(15_39_48/0.14)] py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4">
              <dt className="font-medium">{r.label}</dt>
              <dd>
                <span aria-label={r.value.includes("••••") ? "Masked in this preview" : undefined}>{r.value}</span>
                {r.note && <span className="block text-[12px] opacity-70">{r.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </article>
  );
}
