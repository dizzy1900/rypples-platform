import { expect, type Page } from "@playwright/test";

export const PHONE_MAX = 640;

export function isPhone(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width < PHONE_MAX;
}

/** At phone width the rail is replaced by a top bar; open the nav drawer. No-op on desktop. */
export async function openNav(page: Page) {
  if (!isPhone(page)) return;
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
}

/** Navigate through the real nav (rail on desktop, drawer on phone). */
export async function navTo(page: Page, label: string | RegExp) {
  await openNav(page);
  const scope = isPhone(page) ? page.getByRole("dialog", { name: "Navigation" }) : page;
  await scope.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label }).click();
}

/** Footer "Reset demo": rotates the session cookie, then refreshes. */
export async function resetDemo(page: Page) {
  const res = page.waitForResponse((r) => r.url().includes("/api/demo/reset") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await res;
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeEnabled();
}

/**
 * Resolves once the next server action (a POST to the page) has completed. Call before the click,
 * await after it. Navigating away before this resolves can drop the optimistic write.
 */
export function settled(page: Page) {
  return page.waitForResponse((r) => r.request().method() === "POST" && !r.url().includes("/api/demo/reset"));
}

/** "N open" counter on Home S1. */
export function openDecisions(page: Page) {
  return page.getByRole("region", { name: "Needs your decision" }).getByText(/^\d+ open$/);
}

export const OS_ROUTES = [
  "/",
  "/os",
  "/os/portfolio",
  "/os/pipeline",
  "/os/playbook",
  "/os/growth-engine?tab=programs",
  "/os/growth-engine?tab=partners",
  "/os/growth-engine?tab=talent",
  "/os/growth-engine?tab=scalers",
  "/os/growth-engine?tab=readiness",
  "/os/reporting?tab=update",
  "/os/reporting?tab=impact",
  "/os/reporting?tab=paths",
  "/os/reporting?tab=acceleration",
  "/os/companies/desolenator",
  "/os/companies/desolenator?tab=market",
  "/os/companies/desolenator/schedule",
  "/os/companies/desolenator/diagnostic",
  "/os/diagnostic/new",
  "/connect",
  "/bridge/desolenator",
  "/bridge/desolenator/board-pack",
  "/bridge/desolenator/capital",
  "/bridge/desolenator/how-rypples-works",
  "/bridge/desolenator/schedule",
];
