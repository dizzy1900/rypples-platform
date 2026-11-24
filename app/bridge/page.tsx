import { redirect } from "next/navigation";

/** /bridge on its own has no company, so it opens the demo founder's Bridge (the Welcome page's Bridge link). */
export default function BridgeIndex() {
  redirect("/bridge/desolenator");
}
