import "server-only";
import fs from "node:fs";
import path from "node:path";

/** Photo slots public/people/{id}.jpg. Missing file → monogram. */
export function photoFor(personId: string): string | null {
  try {
    const p = path.join(process.cwd(), "public", "people", `${personId}.jpg`);
    return fs.existsSync(p) ? `/people/${personId}.jpg` : null;
  } catch {
    return null;
  }
}
