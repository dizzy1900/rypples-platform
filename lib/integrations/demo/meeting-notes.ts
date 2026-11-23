import data from "@/data/seed/integrations/meeting-notes.json";
import type { MeetingNotes, SessionNote, SourceTag } from "../types";

const source: SourceTag = { system: "Meeting notes", demo: true };
type Row = Omit<SessionNote, "source"> & { themes: string[] };
const sessions = data.sessions as Row[];

export const demoMeetingNotes: MeetingNotes = {
  async listSince(date) {
    return sessions
      .filter((s) => s.held_at >= date.slice(0, 10))
      .map((row) => {
        const { themes, ...s } = row;
        void themes;
        return { ...s, source };
      });
  },
  async getThemes(id) {
    return sessions.find((s) => s.id === id)?.themes ?? [];
  },
};
