/**
 * The single integrations config: registrations shown in Captain's Connected strip, and the adapters
 * behind each interface. Swap an adapter here for a production one; callers don't change.
 */
import registrations from "@/data/seed/integrations.json";
import type { Crm, DocumentStore, FinanceSystem, IntegrationRegistration, MeetingNotes } from "./types";
import { demoDrive } from "./demo/drive";
import { demoCrm } from "./demo/crm";
import { demoMeetingNotes } from "./demo/meeting-notes";
import { demoFinance } from "./demo/finance";

export const INTEGRATIONS = registrations as IntegrationRegistration[];

export const integrations: { documents: DocumentStore; crm: Crm; meetingNotes: MeetingNotes; finance: FinanceSystem } = {
  documents: demoDrive,
  crm: demoCrm,
  meetingNotes: demoMeetingNotes,
  finance: demoFinance,
};

export const connectedStrip = () => INTEGRATIONS.map((i) => ({ id: i.id, name: i.name, demo: i.demo, status: i.status }));
