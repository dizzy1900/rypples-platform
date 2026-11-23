import { expect, test, type Page } from "@playwright/test";
import { isPhone, settled } from "./helpers";

// Journeys 1, 4, 5, 7 and 12 (docs/11-testing-and-evals.md §3). The dev server runs with LIVE_AI off,
// so every flow here replays precomputed, reviewed content and is deterministic.

const captain = (page: Page) => page.getByRole("dialog", { name: "Captain" });

test.describe("Captain (journey 1)", () => {
  test("Welcome → OS → Home, ⌘K opens Captain with the seeded exchange, a chip navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Rypples OS/ }).first().click();
    await expect(page).toHaveURL(/\/os$/);
    await expect(page.getByText(/of 100 ocean-positive companies/)).toBeVisible();

    if (isPhone(page)) await page.getByRole("button", { name: "Ask Captain" }).first().click();
    else {
      await page.locator("body").click();
      await page.keyboard.press("ControlOrMeta+k");
    }
    const drawer = captain(page);
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Which companies are behind their benchmark");
    await expect(drawer).toContainText("Vessev");
    await expect(drawer).toContainText(/Read \d+ records through the Rypples tool registry/);

    await drawer.getByRole("link", { name: "Portfolio", exact: true }).first().click();
    await expect(page).toHaveURL(/\/os\/portfolio/);
  });

  test("a cached question replays with refs; approving a next step sticks; an unknown question pauses", async ({ page }) => {
    await page.goto("/os?captain=1");
    const drawer = captain(page);
    await expect(drawer).toBeVisible();

    const box = drawer.getByRole("textbox", { name: /Ask Captain/ });
    await box.fill("Where is Growth Engine capacity tight this quarter?");
    await box.press("Enter");
    await expect(drawer).toContainText("Finance is the pinch point", { timeout: 20_000 });
    await expect(drawer).toContainText("1,180 of 1,600");

    const step = drawer.getByText("Hold new finance sprints until the second finance hire starts").locator("xpath=ancestor::li[1]");
    const done = settled(page);
    await step.getByRole("button", { name: "Approve" }).click();
    await done;
    await expect(step).toContainText("Approved");

    await box.fill("What's the weather in Lisbon?");
    await box.press("Enter");
    await expect(drawer).toContainText("Live answers are paused for today", { timeout: 20_000 });
  });
});

test.describe("Diagnostic S5a (journey 4)", () => {
  test("run replays 8 domains, evidence opens, the constraint is confirmed", async ({ page }) => {
    await page.goto("/os/companies/desolenator/diagnostic");
    await page.getByRole("button", { name: "Run diagnostic" }).click();

    const domains = ["Commercial traction", "Financing", "Operations and delivery", "Technology and reliability", "Regulatory", "People", "AI adoption", "Impact integrity"];
    for (const d of domains) await expect(page.getByText(d, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Proposed binding constraint")).toBeVisible({ timeout: 30_000 });

    const ev = page.getByRole("button", { name: /^Evidence from / }).first();
    await ev.click();
    const pop = page.getByRole("dialog", { name: /^Evidence from / });
    await expect(pop).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);

    const done = settled(page);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await done;
    await expect(page.getByText("Confirmed by Jerome Ternynck")).toBeVisible();
  });
});

test.describe("Any company S5b (journey 5)", () => {
  // Outcome streams (ok, declined, ambiguous, insufficient, error) are covered by tests/integration/sse.test.ts
  // against the fixtures. In cached mode with no reviewed precomputed runs the page must say it is paused
  // and keep every run control disabled rather than pretend to run.
  test("cached mode is honest: paused message, run controls disabled", async ({ page }) => {
    await page.goto("/os/diagnostic/new");
    await expect(page.getByRole("heading", { name: "Try it on any ocean company" })).toBeVisible();
    await expect(page.getByText("Live runs are paused for today")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run diagnostic" })).toBeDisabled();
    for (const name of ["Hullbot", "Coral Vita", "Flocean"]) await expect(page.getByRole("button", { name })).toBeDisabled();
  });
});

test.describe("Pipeline → day one (journey 7)", () => {
  test("Mark as led runs F7 for Tern; Bridge, Home and the rail pick it up; Reset removes it", async ({ page }) => {
    await page.goto("/os/pipeline?deal=tern");
    await page.getByRole("button", { name: "Mark as led" }).click();
    await page.getByRole("button", { name: "Start day one" }).click();

    const panel = page.getByText("Day one is under way for Project Tern").locator("xpath=ancestor::section[1]");
    await expect(page.getByText("Day one is under way for Project Tern")).toBeVisible({ timeout: 45_000 });
    await expect(panel).toContainText("130 of 400 hours");
    await expect(panel).toContainText("Plant and Fleet Finance Sprint deferred");
    await expect(panel).toContainText("30 hours left this quarter");
    await expect(panel).toContainText("now 3 of 3 seats");

    await page.getByRole("link", { name: /Open Project Tern in Bridge/ }).click();
    await expect(page).toHaveURL(/\/bridge\/tern/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/os");
    await expect(page.getByText(/^14$/).first()).toBeVisible();
    if (!isPhone(page)) await expect(page.getByRole("complementary").getByText("Project Tern")).toBeVisible();

    const reset = page.waitForResponse((r) => r.url().includes("/api/demo/reset"));
    await page.getByRole("button", { name: "Reset demo" }).click();
    await reset;
    await page.goto("/os");
    await expect(page.getByText(/^13$/).first()).toBeVisible();
    expect((await page.request.get("/bridge/tern")).status()).toBe(404);
  });
});

test.describe("Connect (journey 12)", () => {
  test("the server URL copies and the public tool list renders", async ({ page, context, browserName }) => {
    if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/connect");
    await expect(page.getByText(/\/api\/mcp$/).first()).toBeVisible();
    await page.getByRole("button", { name: "Copy URL" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/api\/mcp$/);
    for (const tool of ["list_portfolio", "portfolio_stats", "get_company", "get_market_evidence"]) {
      await expect(page.getByText(tool, { exact: true })).toBeVisible();
    }
  });
});
