/** 18px line icons, 1.5px stroke, round caps (docs/02-design-system.md §3). */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconHome = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></svg>
);
export const IconPortfolio = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconBook = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20" transform="translate(0 -2)" /></svg>
);
export const IconEngine = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
);
export const IconPipeline = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 5h16M4 12h11M4 19h6" /></svg>
);
export const IconReport = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconCapital = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 20h16M6 16V9M10 16V9M14 16V9M18 16V9M3 9l9-5 9 5" /></svg>
);
export const IconHandshake = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 12l4-4 5 3 5-3 4 4" /><path d="M7 8v6l5 4 5-4V8" /></svg>
);
export const IconDoc = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
);
/** Captain's mark: a ship's wheel. Never a sparkle. */
export const IconWheel = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 1.5v8.5M12 14v8.5M1.5 12H10M14 12h8.5M4.6 4.6l5.9 5.9M13.5 13.5l5.9 5.9M4.6 19.4l5.9-5.9M13.5 10.5l5.9-5.9" /></svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconMenu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconCopy = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconExternal = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconSend = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
);
export const IconPlay = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M7 5l12 7-12 7z" /></svg>
);
export const IconPause = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M8 5v14M16 5v14" /></svg>
);
export const IconPrint = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2" /><rect x="6" y="14" width="12" height="7" /></svg>
);
export const IconDrag = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="9" cy="6" r=".8" /><circle cx="15" cy="6" r=".8" /><circle cx="9" cy="12" r=".8" /><circle cx="15" cy="12" r=".8" /><circle cx="9" cy="18" r=".8" /><circle cx="15" cy="18" r=".8" /></svg>
);
