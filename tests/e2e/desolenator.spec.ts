import { expect, test } from "@playwright/test";
import { getMarkets, scoreMarkets, setWeight, DEFAULT_WEIGHTS, type Weights } from "@/lib/geo";
import { openDecisions, settled } from "./helpers";

const TABS = [
  { key: "diagnostic", label: "Diagnostic" },
  { key: "risks", label: "Technical risks" },
  { key: "market", label: "Market evidence" },
  { key: "programs", label: "Programs" },
  { key: "ledger", label: "Ledger" },
  { key: "board", label: "Board history" },
];

const markets = getMarkets().markets;
const top3 = (w: Weights) => scoreMarkets(markets, w).slice(0, 3).map((r) => r.market.country);

test.describe("Desolenator (S4)", () => {
  test("every tab renders", async ({ page }) => {
    await page.goto("/os/companies/desolenator");
    await expect(page.getByRole("heading", { name: "Desolenator", exact: true })).toBeVisible();
    for (const t of TABS) {
      await page.goto(`/os/companies/desolenator?tab=${t.key}`);
      const tab = page.getByRole("link", { name: t.label, exact: true });
      await expect(tab).toBeVisible();
      await expect(tab).toHaveAttribute("aria-current", /page|true/);
      await expect(page.locator("main")).not.toContainText("Application error");
    }
    // Spot checks on content that proves each tab has a body.
    await page.goto("/os/companies/desolenator?tab=ledger");
    await expect(page.getByText(/How Adri rates Rypples/)).toBeVisible();
    await page.goto("/os/companies/desolenator?tab=programs");
    await expect(page.getByText("Plant and Fleet Finance Sprint").first()).toBeVisible();
  });

  test("market evidence ranking follows the scoring function", async ({ page }) => {
    // Preconditions on the data, so a data change fails loudly here rather than as a confusing UI diff.
    const water80 = setWeight(DEFAULT_WEIGHTS, "water", 80);
    const presence0 = setWeight(DEFAULT_WEIGHTS, "presence", 0);
    expect(top3(presence0)).not.toEqual(top3(DEFAULT_WEIGHTS));

    await page.goto("/os/companies/desolenator?tab=market");
    const rows = page.getByRole("list", { name: "Ranked markets" }).getByRole("listitem");
    const expectTop3 = async (w: Weights) => {
      const expected = top3(w);
      for (let i = 0; i < 3; i++) await expect(rows.nth(i).locator("span.h2")).toHaveText(expected[i]);
      await expect(page.locator("#why-three + ol li").nth(0)).toContainText(expected[0]);
    };
    const [water, , presence] = [0, 1, 2].map((i) => page.getByRole("slider").nth(i));

    await expectTop3(DEFAULT_WEIGHTS);

    await water.fill("80");
    await expect(water).toHaveValue("80");
    await expectTop3(water80);

    // Reset water, then zero out presence: this one changes the top three.
    await water.fill("50");
    await expectTop3(setWeight(water80, "water", 50));
    const base = setWeight(water80, "water", 50);
    await presence.fill("0");
    const expected = setWeight(base, "presence", 0);
    await expectTop3(expected);
    expect(top3(expected)).not.toEqual(top3(DEFAULT_WEIGHTS));
  });

  test("resolving the decision drops Home to 2 open", async ({ page }) => {
    await page.goto("/os");
    await expect(openDecisions(page)).toHaveText("3 open");

    await page.goto("/os/companies/desolenator");
    await expect(page.getByText("Take a first-loss position in plant SPV #1?")).toBeVisible();
    const saved = settled(page);
    await page.getByRole("button", { name: "Discuss at the board" }).click();
    await saved;
    await expect(page.getByRole("button", { name: "Discuss at the board" })).toHaveCount(0);

    await page.goto("/os");
    await expect(openDecisions(page)).toHaveText("2 open");
    await expect(page.getByText("Take a first-loss position in plant SPV #1?")).toHaveCount(0);
  });
});
