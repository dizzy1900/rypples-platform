/**
 * The link preview image (Open Graph) for every page: the hero line on the ocean background.
 * Built once at build time. No screenshots or figures, only the brand and the promise.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "The Rypples Platform: the system behind the Growth Engine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ABYSS = "#001a24";
const LIME = "#accf09";
const INK_2 = "rgba(255,255,255,0.72)";
const RING = "rgba(255,255,255,0.05)";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/rypples-logo.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const ring = (cx: number, cy: number, r: number) => (
    <div
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        border: `2px solid ${RING}`,
      }}
    />
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: ABYSS, padding: "72px 80px" }}>
        {ring(1080, 90, 380)}
        {ring(1080, 90, 260)}
        {ring(1080, 90, 140)}
        {ring(60, 640, 300)}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <img src={logoSrc} width={236} height={61} alt="" />
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
            <div style={{ fontSize: 72, lineHeight: 1.04, letterSpacing: "-0.03em", color: "#ffffff", fontWeight: 600 }}>
              The system behind the Growth Engine
            </div>
            <div style={{ width: 90, height: 5, borderRadius: 3, background: LIME, marginTop: 28 }} />
            <div style={{ fontSize: 30, lineHeight: 1.45, color: INK_2, marginTop: 28 }}>
              Find the one constraint that matters, deliver the help that clears it, and learn from every company.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
