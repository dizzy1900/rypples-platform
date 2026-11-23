/**
 * /connect · Use Rypples from your own Claude (docs/06-screens.md, docs/08 §3).
 * Standalone public page. The tool list renders from the registry metadata.
 */
import Link from "next/link";
import { env } from "@/lib/env";
import { toolMeta } from "@/lib/tools/registry";
import { Eyebrow, H1, H2, Lede, TextLink } from "@/components/ui";
import { CopyButton } from "@/components/ui/client";

export const metadata = { title: "Rypples in your Claude" };

const HELP_ARTICLE = "https://support.anthropic.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp";

const QUESTIONS = [
  "Which portfolio companies are over their benchmark?",
  "What's Desolenator's binding constraint, with sources?",
  "Where should Desolenator's next three plants go?",
  "Which Playbook lessons apply to a company selling to ports?",
];

function CodeField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 well px-4 py-3">
      <code className="min-w-0 flex-1 break-all text-[14px] text-ink">{value}</code>
      <CopyButton text={value} label={label} />
    </div>
  );
}

export default function ConnectPage() {
  const site = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const url = `${site}/api/mcp`;
  const cli = `claude mcp add --transport http rypples ${url}`;
  const tools = toolMeta();
  return (
    <div className="min-h-screen bg-abyss">
      <div className="mx-auto flex max-w-[860px] flex-col gap-12 px-4 pb-24 pt-8 sm:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.svg" alt="" width={24} height={24} />
            <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">Rypples</span>
          </Link>
          <TextLink href="/">Back to the platform</TextLink>
        </header>

        <section className="flex flex-col gap-5">
          <Eyebrow>Captain, anywhere</Eyebrow>
          <H1>Rypples in your Claude</H1>
          <Lede>
            The same tools Captain uses are published as a read-only MCP server over this demo&rsquo;s public data. Add it to Claude and ask about the
            portfolio from wherever you work.
          </Lede>
        </section>

        <section aria-labelledby="url-h" className="flex flex-col gap-3">
          <H2 id="url-h">Server URL</H2>
          <CodeField value={url} label="Copy URL" />
        </section>

        <section aria-labelledby="web-h" className="flex flex-col gap-3">
          <H2 id="web-h">Claude on the web or desktop</H2>
          <p className="text-[15px] text-ink-2">
            Add the server URL as a custom connector in Claude&rsquo;s connector settings. No sign-in is needed: the server is read-only and holds only public and
            illustrative demo data. Anthropic&rsquo;s help article walks through adding a custom connector:{" "}
            <TextLink href={HELP_ARTICLE} external>
              Getting started with custom connectors
            </TextLink>
            .
          </p>
        </section>

        <section aria-labelledby="code-h" className="flex flex-col gap-3">
          <H2 id="code-h">Claude Code</H2>
          <CodeField value={cli} label="Copy command" />
        </section>

        <section aria-labelledby="ask-h" className="flex flex-col gap-3">
          <H2 id="ask-h">Try asking</H2>
          <ul className="flex flex-col gap-2">
            {QUESTIONS.map((q) => (
              <li key={q} className="tile px-4 py-3 text-[15px] text-ink">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="tools-h" className="flex flex-col gap-3">
          <H2 id="tools-h">What it can see</H2>
          <p className="text-[15px] text-ink-2">Read-only. Public and illustrative demo data only. No Rypples OS session data.</p>
          <ul className="flex flex-col tile divide-y divide-line-2">
            {tools.map((t) => (
              <li key={t.name} className="flex flex-col gap-1 px-4 py-3">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-[15px] font-semibold text-ink">{t.title}</span>
                  <code className="text-[12px] text-ink-3">{t.name}</code>
                </span>
                <span className="text-[13px] text-ink-2">{t.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
