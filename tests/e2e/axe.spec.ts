import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { OS_ROUTES } from "./helpers";

// Serious and critical violations fail the run. Moderate/minor are reported in the attachment only.
for (const route of OS_ROUTES) {
  test(`axe: ${route}`, async ({ page }, info) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (results.violations.length)
      await info.attach("axe-violations.json", { body: JSON.stringify(results.violations, null, 2), contentType: "application/json" });
    expect(
      bad.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`),
    ).toEqual([]);
  });
}
