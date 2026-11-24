import { redirect } from "next/navigation";

/** /engine on its own has no company, so it opens the demo founder's Rypples Engine. */
export default function EngineIndex() {
  redirect("/engine/desolenator");
}
