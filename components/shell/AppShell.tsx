"use client";
/**
 * The OS and Bridge shell (docs/02-design-system.md §3, §10): rail, sheet, footer,
 * Captain drawer host with ⌘K, and the phone-width top bar with a nav sheet.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { CaptainContext, Drawer } from "@/components/ui/client";
import { Monogram } from "@/components/ui";
import {
  IconBook,
  IconCapital,
  IconClose,
  IconDoc,
  IconEngine,
  IconHandshake,
  IconHome,
  IconMenu,
  IconPipeline,
  IconPortfolio,
  IconReport,
  IconWheel,
} from "@/components/ui/icons";
import { CaptainDrawer } from "@/components/captain/CaptainDrawer";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; exact?: boolean };
const ICONS = {
  home: IconHome,
  portfolio: IconPortfolio,
  book: IconBook,
  engine: IconEngine,
  pipeline: IconPipeline,
  report: IconReport,
  doc: IconDoc,
  capital: IconCapital,
  handshake: IconHandshake,
};

export type ShellProps = {
  product: "OS" | "Bridge";
  nav: NavItem[];
  companyBlock?: { name: string; meta: string } | null;
  boardSeats?: { slug: string; name: string; nextBoard: string; added: boolean }[];
  profile: { name: string; title: string; initials: string; photo: string | null; href: string; switchLabel: string };
  captainScope: { kind: "os" } | { kind: "bridge"; slug: string; companyName: string };
  homeHref: string;
  children: ReactNode;
};

function Wordmark({ product, href }: { product: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`Rypples ${product} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.svg" alt="" width={28} height={28} />
      <span className="font-display text-[21px] font-semibold tracking-[-0.02em] text-ink">Rypples</span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">{product}</span>
    </Link>
  );
}

function NavList({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {nav.map((n) => {
        const Icon = ICONS[n.icon];
        const active = n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-item px-3 py-[9px] text-[14px] font-medium transition-colors",
                active ? "bg-lime-10 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className={active ? "text-lime" : "text-ink-3"} />
              <span className="flex-1">{n.label}</span>
              {n.badge != null && n.badge > 0 && (
                <span className="rounded-pill bg-lime-15 px-2 py-[1px] text-[11px] font-semibold text-lime" aria-label={`${n.badge} open`}>
                  {n.badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ProfileBlock({ profile }: { profile: ShellProps["profile"] }) {
  return (
    <Link
      href={profile.href}
      className="group flex items-center gap-3 rounded-item p-2 hover:bg-surface-2"
      title={profile.switchLabel}
    >
      <Monogram initials={profile.initials} photo={profile.photo} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink">{profile.name}</span>
        <span className="truncate text-[12px] text-ink-3">{profile.title}</span>
        <span className="text-[11px] text-lime opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {profile.switchLabel} →
        </span>
      </span>
    </Link>
  );
}

function RailContents({ props, onNavigate }: { props: ShellProps; onNavigate?: () => void }) {
  return (
    <>
      {props.companyBlock && (
        <div className="mb-4 rounded-item border border-line-2 bg-surface px-3 py-2.5">
          <p className="text-[13px] font-semibold text-ink">{props.companyBlock.name}</p>
          <p className="meta">{props.companyBlock.meta}</p>
        </div>
      )}
      <NavList nav={props.nav} onNavigate={onNavigate} />
      {props.boardSeats && props.boardSeats.length > 0 && (
        <div className="mt-8">
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">Board seats</p>
          <ul className="flex flex-col gap-0.5">
            {props.boardSeats.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/os/companies/${b.slug}`}
                  onClick={onNavigate}
                  className="flex items-baseline justify-between gap-2 rounded-item px-3 py-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  <span>{b.name}</span>
                  <span className="meta">{b.nextBoard ? `Board ${b.nextBoard}` : b.added ? "Added in this session" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function ResetDemoLink({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={clsx("underline-offset-2 hover:text-ink hover:underline", className)}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/demo/reset", { method: "POST" });
        } finally {
          router.refresh();
          setBusy(false);
        }
      }}
    >
      {busy ? "Resetting…" : "Reset demo"}
    </button>
  );
}

export function ScenarioFooter() {
  return (
    <footer className="no-print mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line px-10 py-5 text-[12px] text-ink-3 max-sm:px-5">
      <p>
        Demo scenario: Rypples leads Desolenator&rsquo;s next round. Public facts are sourced. Figures with a dotted underline are
        illustrative.{" "}
        <Link href="/?about=1" className="underline underline-offset-2 hover:text-ink">
          What&rsquo;s real
        </Link>
      </p>
      <ResetDemoLink />
    </footer>
  );
}

function CaptainHost({ scope, children }: { scope: ShellProps["captainScope"]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const urlOpen = sp.get("captain") === "1";
  const [open, setOpen] = useState(urlOpen);
  const [prefill, setPrefill] = useState<string | undefined>(sp.get("ask") ?? undefined);

  useEffect(() => setOpen(urlOpen), [urlOpen]);

  const setUrl = useCallback(
    (o: boolean) => {
      const q = new URLSearchParams(sp.toString());
      if (o) q.set("captain", "1");
      else {
        q.delete("captain");
        q.delete("ask");
      }
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  const openCaptain = useCallback(
    (p?: string) => {
      setPrefill(p);
      setOpen(true);
      setUrl(true);
    },
    [setUrl],
  );
  const close = useCallback(() => {
    setOpen(false);
    setUrl(false);
  }, [setUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else openCaptain();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openCaptain, close]);

  return (
    <CaptainContext.Provider value={{ open: openCaptain }}>
      {children}
      <Drawer open={open} onClose={close} title="Captain">
        <CaptainDrawer scope={scope} onClose={close} prefill={prefill} />
      </Drawer>
    </CaptainContext.Provider>
  );
}

export function AppShell(props: ShellProps) {
  return (
    <Suspense>
      <ShellInner {...props} />
    </Suspense>
  );
}

function ShellInner(props: ShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <CaptainHost scope={props.captainScope}>
      <div className="flex min-h-screen bg-abyss">
        {/* Rail (desktop) */}
        <aside className="no-print sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col px-4 pb-4 pt-6 sm:flex">
          <div className="px-2 pb-8">
            <Wordmark product={props.product} href={props.homeHref} />
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto">
            <RailContents props={props} />
          </nav>
          <ProfileBlock profile={props.profile} />
        </aside>

        {/* Phone top bar */}
        <div className="no-print fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-abyss px-4 py-3 sm:hidden">
          <Wordmark product={props.product} href={props.homeHref} />
          <div className="flex items-center gap-1">
            <PhoneCaptainButton />
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
              className="rounded-btn p-2 text-ink-2"
            >
              <IconMenu />
            </button>
          </div>
        </div>
        <Drawer open={navOpen} onClose={() => setNavOpen(false)} title="Navigation" width={360}>
          <div className="flex items-center justify-between px-5 py-4">
            <Wordmark product={props.product} href={props.homeHref} />
            <button type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)} className="p-2 text-ink-2">
              <IconClose />
            </button>
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto px-4">
            <RailContents props={props} onNavigate={() => setNavOpen(false)} />
          </nav>
          <div className="border-t border-line-2 p-4">
            <ProfileBlock profile={props.profile} />
          </div>
        </Drawer>

        {/* Stage + sheet */}
        <div className="flex min-w-0 flex-1 flex-col pt-3 pr-3 max-sm:pt-[60px] max-sm:pr-0">
          <main
            id="main"
            className="flex min-h-[calc(100vh-12px)] flex-col rounded-t-sheet bg-ocean shadow-[var(--shadow-sheet)] max-sm:rounded-t-[20px]"
          >
            {props.children}
            <ScenarioFooter />
          </main>
        </div>
      </div>
    </CaptainHost>
  );
}

function PhoneCaptainButton() {
  return (
    <CaptainContext.Consumer>
      {({ open }) => (
        <button type="button" aria-label="Ask Captain" onClick={() => open()} className="rounded-btn p-2 text-lime">
          <IconWheel />
        </button>
      )}
    </CaptainContext.Consumer>
  );
}
