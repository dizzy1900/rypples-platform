import Link from "next/link";
import { Suspense } from "react";
import { AboutModal } from "@/components/rypples/AboutModal";
import { IconHandshake, IconPortfolio } from "@/components/ui/icons";

export const metadata = { title: { absolute: "The Rypples Platform" } };

const STEPS = [
  { n: "01", title: "Day 0", text: "The diligence diagnostic becomes the plan, and the Growth Engine allocation is written into the term sheet." },
  { n: "02", title: "First 100 days", text: "The one binding constraint is confirmed with the founder. Programs start and a board rhythm is set." },
  { n: "03", title: "Every quarter", text: "Board pack, diagnostic, programs, Playbook. The same rhythm, every quarter." },
  { n: "04", title: "Strategic path", text: "A map of strategic buyers, investors and acquirers is kept current from day 0, the WSense play." },
];

const PRINCIPLES = [
  { title: "One constraint at a time", text: "All help goes to what limits growth now. Each company has exactly one confirmed binding constraint." },
  { title: "Founder-owned", text: "The plan belongs to the founder, and Rypples sees it. Founders choose their programs and can disagree with the constraint." },
  { title: "Evidence, not opinion", text: "Every score and finding links to its source. A domain without evidence shows an evidence gap, never a guess." },
  { title: "Agents draft, people decide", text: "Every AI output is a proposal with provenance. Nothing counts until a named person approves it." },
  { title: "Measured both ways", text: "Founders rate everything Rypples delivers, and Jerome sees the ratings unfiltered." },
  { title: "Integrate, don't rebuild", text: "Data rooms, CRM, documents, meeting notes and finance systems stay in the tools that do them best, and connect through MCP and adapters." },
];

function Arcs() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 1200"
      preserveAspectRatio="xMidYMin slice"
    >
      <g fill="rgb(255 255 255 / 0.025)">
        <circle cx="1280" cy="140" r="520" />
        <circle cx="1280" cy="140" r="360" />
        <circle cx="1280" cy="140" r="200" />
        <circle cx="120" cy="760" r="460" />
        <circle cx="120" cy="760" r="300" />
      </g>
    </svg>
  );
}

export default function Welcome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-abyss">
      <Arcs />
      <div className="relative mx-auto flex max-w-[1180px] flex-col px-5 sm:px-10">
        <header className="flex items-center gap-2.5 py-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" width={28} height={28} />
          <span className="font-display text-[21px] font-semibold tracking-[-0.02em] text-ink">Rypples</span>
        </header>
      </div>

      <main className="relative">
        {/* Panel 1: hero and the two doors */}
        <section
          aria-labelledby="hero-h"
          className="relative z-10 mx-auto max-w-[1280px] rounded-t-hero bg-ocean px-5 pb-28 pt-14 shadow-[var(--shadow-sheet)] max-sm:rounded-t-[40px] sm:px-16 sm:pt-20"
        >
          <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
            <div className="flex flex-col gap-5">
              <p className="eyebrow">Prototype · November 2026</p>
              <h1 id="hero-h" className="h1 md:text-[60px]">
                The system behind the Growth Engine
              </h1>
              <span className="h1-rule" aria-hidden />
              <p className="lede">
                One platform for Rypples and the companies it anchors. Find the one constraint that matters, deliver the help that clears it,
                and learn from every company so the next one scales faster.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Link href="/os" className="tile-outline group flex flex-col gap-4 p-7 transition-colors hover:border-lime">
                <IconPortfolio size={28} className="text-lime" />
                <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Rypples OS</h2>
                <p className="text-[14px] text-ink-2">
                  For the Rypples team. Decisions, portfolio, the Playbook, the Growth Engine, pipeline and reporting.
                </p>
                <span className="text-link mt-auto pt-2 text-[14px]">Enter as Jerome Ternynck →</span>
              </Link>
              <Link href="/bridge/desolenator" className="tile-outline group flex flex-col gap-4 p-7 transition-colors hover:border-lime">
                <IconHandshake size={28} className="text-lime" />
                <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Rypples Bridge</h2>
                <p className="text-[14px] text-ink-2">
                  For founders. A board pack drafted for you, your plan and programs, and a ledger of what Rypples owes you.
                </p>
                <span className="text-link mt-auto pt-2 text-[14px]">Enter as Adri Pols, Desolenator →</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Panel 2: lifecycle */}
        <section
          aria-labelledby="rhythm-h"
          className="relative z-20 mx-auto -mt-20 max-w-[1280px] rounded-t-hero bg-ocean px-5 pb-28 pt-14 shadow-[var(--shadow-sheet)] max-sm:-mt-10 max-sm:rounded-t-[40px] sm:px-16 sm:pt-20"
        >
          <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h2 id="rhythm-h" className="font-display text-[32px] font-medium tracking-[-0.03em] text-ink sm:text-[40px]">
                One rhythm, every company.
              </h2>
            </div>
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex flex-col gap-3 border-t border-lime-30 pt-5">
                  <span className="eyebrow">{s.n}</span>
                  <h3 className="text-[16px] font-semibold text-ink">{s.title}</h3>
                  <p className="text-[14px] text-ink-2">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Panel 3: principles, links, disclaimer */}
        <section
          aria-labelledby="principles-h"
          className="relative z-30 mx-auto -mt-20 max-w-[1280px] rounded-t-hero bg-ocean px-5 pb-16 pt-14 shadow-[var(--shadow-sheet)] max-sm:-mt-10 max-sm:rounded-t-[40px] sm:px-16 sm:pt-20"
        >
          <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
            <h2 id="principles-h" className="font-display text-[32px] font-medium tracking-[-0.03em] text-ink sm:text-[40px]">
              Adding value, not taking over.
            </h2>
            <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {PRINCIPLES.map((p, i) => (
                <li key={p.title} className="flex flex-col gap-2 border-t border-line-2 pt-5">
                  <span className="meta">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-[15px] font-semibold text-ink">{p.title}</h3>
                  <p className="text-[14px] text-ink-2">{p.text}</p>
                </li>
              ))}
            </ol>

            <nav aria-label="More" className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line-2 pt-8">
              <Link href="/os/diagnostic/new" className="text-link text-[14px]">
                Try it on any ocean company
              </Link>
              <Link href="/connect" className="text-link text-[14px]">
                Connect Rypples to your Claude
              </Link>
              <Suspense fallback={null}>
                <AboutModal />
              </Suspense>
            </nav>

            <p className="meta max-w-[760px]">
              Demo scenario: Rypples leads Desolenator&rsquo;s next round. Public facts are sourced. Figures with a dotted underline are
              illustrative.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
