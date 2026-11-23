import type { Metadata, Viewport } from "next";
import { Montserrat, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-syne" });
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: { default: "The Rypples Platform", template: "%s · Rypples" },
  description:
    "One platform for Rypples and the companies it anchors: find the one constraint that matters, deliver the help that clears it, and learn from every company.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  icons: { icon: "/brand/mark.svg" },
};

export const viewport: Viewport = { themeColor: "#001A24", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${syne.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
