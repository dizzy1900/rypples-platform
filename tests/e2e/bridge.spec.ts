import { expect, test } from "@playwright/test";
import { openDecisions, settled } from "./helpers";

test.describe("Bridge (Desolenator)", () => {
  test("rating commitment l2 shows on the company ledger", async ({ page }) => {
    await page.goto("/bridge/desolenator");
    const title = "Plant-level model review";
    const group = page.getByRole("radiogroup", { name: `Rate: ${title}` });
    await expect(group.locator("xpath=following-sibling::*")).toHaveText("Rated 5 of 5");

    const saved = settled(page);
    await group.getByText("3", { exact: true }).click();
    await saved;
    await expect(group.getByRole("radio", { name: "3 of 5" })).toBeChecked();
    await expect(group.locator("xpath=following-sibling::*")).toHaveText("Rated 3 of 5");

    await page.goto("/os/companies/desolenator?tab=ledger");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("3 / 5");
    // Mean of 3 and 4 across the two delivered commitments.
    await expect(page.getByText(/How Adri rates Rypples 3\.5 \/ 5/)).toBeVisible();
  });

  test("disputing the constraint raises a decision on Home", async ({ page }) => {
    await page.goto("/os");
    await expect(openDecisions(page)).toHaveText("3 open");

    await page.goto("/bridge/desolenator");
    await page.getByRole("button", { name: "I see it differently" }).click();
    await page.getByRole("button", { name: "Send to my board partner" }).click();
    await expect(page.getByText("Choose the domain you see as the constraint.")).toBeVisible();

    await page.getByLabel("Where do you see the constraint?").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Send to my board partner" }).click();
    await expect(page.getByText("Add a short note so your board partner has context.")).toBeVisible();

    await page.getByLabel("Your note for your board partner").fill("Pilots are converting slowly; buyers are the limit.");
    const saved = settled(page);
    await page.getByRole("button", { name: "Send to my board partner" }).click();
    await saved;
    await expect(page.getByRole("status").filter({ hasText: "Sent to your board partner" })).toBeVisible();

    await page.goto("/os");
    await expect(openDecisions(page)).toHaveText("4 open");
    await expect(page.getByText(/sees the constraint differently/)).toBeVisible();
    await expect(page.getByText(/Pilots are converting slowly/)).toBeVisible();
  });

  test("board pack cannot be shared until its sections are ready", async ({ page }) => {
    await page.goto("/bridge/desolenator");
    await expect(page.getByText("3 of 6 sections ready")).toBeVisible();

    await page.goto("/bridge/desolenator/board-pack");
    const share = page.getByRole("button", { name: "Share with the board" });
    await expect(share).toBeDisabled();
    await expect(page.getByText(/Still needs you: CEO letter, Pilots and plant pipeline, Operations and uptime\./).first()).toBeVisible();
    // Disabled controls cannot be forced either.
    await expect(share).toHaveAttribute("title", /Still needs you/);
  });
});

test.describe("Capital", () => {
  test("shortlist toggles and persists", async ({ page }) => {
    await page.goto("/bridge/desolenator/capital");
    const eu = page.getByRole("button", { name: /: EU BlueInvest network$/ });
    await expect(eu).toHaveAttribute("aria-pressed", "false");
    const saved = settled(page);
    await eu.click();
    await saved;
    await expect(eu).toHaveAttribute("aria-pressed", "true");
    await expect(eu).toHaveText("Shortlisted");

    await page.reload();
    await expect(page.getByRole("button", { name: "Shortlisted: EU BlueInvest network" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Shortlisted: EU BlueInvest network" }).click();
    await expect(page.getByRole("button", { name: "Shortlist: EU BlueInvest network" })).toHaveAttribute("aria-pressed", "false");
  });

  test("confirming a pilot stage feeds the board pack pilots section", async ({ page }) => {
    await page.goto("/bridge/desolenator/board-pack?section=pilots");
    await expect(page.getByText("Pilot · confirm", { exact: true })).toHaveCount(2);

    await page.goto("/bridge/desolenator/capital");
    const stages = page.getByRole("list", { name: "DEWA stages" });
    const current = stages.locator("[aria-current=step]");
    await expect(current).toContainText("Pilot");
    await page.getByRole("button", { name: "Change DEWA to Multi-site" }).click();
    const saved = settled(page);
    await page.getByRole("button", { name: "Confirm Multi-site" }).click();
    await saved;
    await expect(stages.locator("[aria-current=step]")).toContainText("Multi-site");

    await page.goto("/bridge/desolenator/board-pack?section=pilots");
    await expect(page.getByText("Multi-site · confirmed")).toBeVisible();
    await expect(page.getByText("Pilot · confirm", { exact: true })).toHaveCount(1); // Silal is still unconfirmed
  });
});

test("How Rypples works: the allocation caps requests", async ({ page }) => {
  await page.goto("/bridge/desolenator/how-rypples-works");
  await expect(page.getByText("2 of 3 used")).toBeVisible();
  const request = page.getByRole("button", { name: "Request", exact: true });
  const before = await request.count();
  expect(before).toBeGreaterThan(1);

  const saved = settled(page);
  await request.first().click();
  await saved;
  await expect(page.getByText("3 of 3 used")).toBeVisible();
  await expect(page.getByRole("button", { name: "Requested" })).toBeDisabled();

  const capped = page.getByRole("button", { name: /Allocation used/ });
  await expect(capped).toHaveCount(before - 1 + 1 /* the proposed "Accept" card is capped too */);
  for (const b of await capped.all()) await expect(b).toBeDisabled();
  await expect(page.getByRole("button", { name: "Request", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("3 of 3 used")).toBeVisible();
});
