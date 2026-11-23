import { expect, test } from "@playwright/test";

test.describe("Reporting", () => {
  // References come from the precomputed Q4 draft (data/precomputed/f6-q4.json).
  test("a reference popover resolves", async ({ page }) => {
    await page.goto("/os/reporting?tab=update");
    const ref = page.locator("[data-ref-type]").first();
    await expect(ref).toBeVisible({ timeout: 20_000 });
    await ref.click();
    const pop = page.getByRole("dialog", { name: /^Source of / });
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("Provenance");
    await expect(pop).toContainText("Record");
    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);
  });

  test("Acceleration renders the learning curve and filters by People", async ({ page }) => {
    await page.goto("/os/reporting?tab=acceleration");
    await expect(page.getByRole("heading", { name: "The learning curve" })).toBeVisible();
    const chart = page.locator("#curve-h").locator("xpath=ancestor::section[1]").locator("svg").first();
    await expect(chart).toBeVisible();
    expect(await chart.locator("circle, path, rect, line").count()).toBeGreaterThan(3);

    const count = page.getByTestId("case-count");
    await expect(count).toContainText("cleared cases");
    const people = page.getByRole("group", { name: "Filter the curve by domain" }).getByRole("button", { name: "People", exact: true });
    await people.click();
    await expect(people).toHaveAttribute("aria-pressed", "true");
    await expect(count).toContainText("5 of 8 cases");
    await people.click();
    await expect(count).toContainText("cleared cases");
  });

  test("every tab renders", async ({ page }) => {
    for (const tab of ["update", "impact", "paths", "acceleration"]) {
      await page.goto(`/os/reporting?tab=${tab}`);
      await expect(page.getByRole("heading", { level: 1, name: "What shareholders see" })).toBeVisible();
    }
  });
});
