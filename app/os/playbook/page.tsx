import { TopBar, Page } from "@/components/shell/TopBar";
import { Illustrative, PageHeader, Section, Table, Td, Th, Tile } from "@/components/ui";
import { IntakeList } from "@/components/rypples/playbook/IntakeList";
import { LessonCard } from "@/components/rypples/playbook/LessonCard";
import { Replay } from "@/components/rypples/playbook/Replay";
import { Travels } from "@/components/rypples/playbook/Travels";
import { getState } from "@/lib/data";
import { getPlaybook } from "@/lib/data/projections/playbook";
import { getSessionId } from "@/lib/session";

export const metadata = { title: "Playbook" };

export default async function PlaybookPage() {
  const s = await getState(await getSessionId());
  const p = getPlaybook(s);
  return (
    <>
      <TopBar crumbs={[{ label: "Home", href: "/os" }, { label: "Playbook" }]} placeholder="Ask Captain about the Playbook" />
      <Page>
        <PageHeader
          eyebrow="Playbook"
          title="What WSense taught us"
          lede="Rypples' first exit, written down so the next three companies don't have to learn it the hard way."
        />

        <Section
          id="intake"
          title="Coming in this week"
          meta="Captain reads board meetings, partner sessions and founder circles from your meeting notes, and proposes lessons. A person approves every one."
          aside={<span className="meta">{p.intakeCount}</span>}
        >
          <IntakeList rows={p.intake} />
        </Section>

        <Section id="lesson" title="The lesson">
          <LessonCard lesson={p.lesson} />
        </Section>

        <Section id="replay" title={`Replay ${p.lesson.learnedIn}`}>
          <Replay steps={p.replay} company={p.lesson.learnedIn} />
        </Section>

        <Section id="travels" title="Who it travels to">
          <Travels travels={p.travels} names={p.names} decisionOpen={p.wsenseDecisionOpen} />
        </Section>

        <Section id="library" title="More from the Playbook">
          <Tile className="py-2">
            <Table>
              <thead>
                <tr>
                  <Th>Lesson</Th>
                  <Th>Domain</Th>
                  <Th>Learned in</Th>
                  <Th>Sent</Th>
                  <Th>Helped</Th>
                </tr>
              </thead>
              <tbody>
                {p.library.map((l) => (
                  <tr key={l.id}>
                    <Td className="text-ink">{l.title}</Td>
                    <Td>{l.domain}</Td>
                    <Td>{l.learnedIn}</Td>
                    <Td>{l.sent}</Td>
                    <Td>
                      <Illustrative>
                        {l.helped} of {l.sent}
                      </Illustrative>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Tile>
        </Section>
      </Page>
    </>
  );
}
