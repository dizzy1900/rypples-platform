import { expect, test } from "@playwright/test";

test("Portfolio: filter Maritime, constraint map, open Vessev", async ({ page }) => {
  await page.goto("/os/portfolio");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const stats = page.locator("[aria-live=polite]").first();
  const before = await stats.innerText();
  const vessev = page.locator("li", { has: page.getByRole("link", { name: "Vessev", exact: true }) });
  const desolenator = page.locator("li", { has: page.getByRole("link", { name: "Desolenator", exact: true }) });
  await expect(vessev).not.toHaveClass(/opacity-25/);
  await expect(desolenator).not.toHaveClass(/opacity-25/);

  await page.getByRole("navigation", { name: "Filter by vertical" }).getByRole("link", { name: "Maritime" }).click();
  await expect(page).toHaveURL(/vertical=Maritime/);
  // Rows outside the vertical dim, rows inside do not, and the stats recalculate.
  await expect(desolenator).toHaveClass(/opacity-25/);
  await expect(vessev).not.toHaveClass(/opacity-25/);
  await expect(stats).not.toHaveText(before);

  // Constraint map keeps the filter.
  await page.getByRole("group", { name: "View" }).getByRole("link", { name: "Constraint map" }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(page).toHaveURL(/vertical=Maritime/);
  await expect(page.getByText("Commercial traction").first()).toBeVisible();

  await page.getByRole("link", { name: "Vessev", exact: true }).click();
  await expect(page).toHaveURL(/\/os\/companies\/vessev/);
  await expect(page.getByRole("heading", { name: "Vessev", exact: true })).toBeVisible();
  await expect(page.getByText("Binding constraint").first()).toBeVisible();
  await expect(page.getByText("Rates Rypples")).toBeVisible();
});
