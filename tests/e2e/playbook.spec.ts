import { expect, test } from "@playwright/test";

const SEND_DESOLENATOR = (page: import("@playwright/test").Page) => page.getByTestId("send-desolenator");

test.describe("Playbook", () => {
  test("send is blocked before approval; approve; send mounts then unmounts the ripple", async ({ page }) => {
    await page.goto("/os/playbook");
    const travel = page.getByTestId("travel-desolenator");
    await expect(travel.getByRole("button", { name: "Approve first" })).toBeDisabled();
    await expect(SEND_DESOLENATOR(page)).toHaveCount(0);
    await expect(page.locator("canvas[data-ripple]")).toHaveCount(0);

    await page.getByRole("button", { name: "Approve lesson" }).click();
    await expect(page.getByRole("button", { name: "Approved" })).toBeDisabled();
    await expect(SEND_DESOLENATOR(page)).toBeEnabled();

    await SEND_DESOLENATOR(page).click();
    await expect(page.locator("canvas[data-ripple]")).toHaveCount(1);
    await expect(page.locator("canvas[data-ripple]")).toHaveCount(0, { timeout: 5000 });

    await expect(travel.getByRole("button", { name: "Sent" })).toBeDisabled();
    await expect(travel.locator("[data-status=sent]")).toBeVisible();
    // The other matched companies were not sent.
    await expect(page.getByTestId("travel-flocean").locator("[data-status=matched]")).toBeVisible();
  });

  test("sending resolves the Playbook decision on Home", async ({ page }) => {
    await page.goto("/os/playbook");
    await page.getByRole("button", { name: "Approve lesson" }).click();
    await SEND_DESOLENATOR(page).click();
    await expect(page.getByTestId("travel-desolenator").locator("[data-status=sent]")).toBeVisible();
    await page.goto("/os");
    await expect(page.getByText("Send the WSense lesson to Desolenator, Flocean and Marble?")).toHaveCount(0);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("no ripple canvas mounts, but the send still lands", async ({ page }) => {
      await page.goto("/os/playbook");
      await page.getByRole("button", { name: "Approve lesson" }).click();
      await expect(SEND_DESOLENATOR(page)).toBeEnabled();

      // Watch for a canvas for the whole send; none may ever appear.
      await page.evaluate(() => {
        (window as unknown as { __ripples: number }).__ripples = 0;
        new MutationObserver(() => {
          if (document.querySelector("canvas[data-ripple]")) (window as unknown as { __ripples: number }).__ripples++;
        }).observe(document.body, { childList: true, subtree: true });
      });
      await SEND_DESOLENATOR(page).click();
      await expect(page.getByTestId("travel-desolenator").locator("[data-status=sent]")).toBeVisible();
      await page.waitForTimeout(1800); // longer than the 1.6s canvas lifetime
      expect(await page.evaluate(() => (window as unknown as { __ripples: number }).__ripples)).toBe(0);
      await expect(page.locator("canvas[data-ripple]")).toHaveCount(0);
    });
  });

  test("replay steps through 4 dates", async ({ page }) => {
    await page.goto("/os/playbook");
    const replay = page.getByRole("group", { name: /Replay .*choose a date/ });
    const radios = replay.getByRole("radio");
    await expect(radios).toHaveCount(4);
    const happened = page.locator("h4", { hasText: "What happened" }).locator("xpath=following-sibling::*[1]");

    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      await replay.locator("label").nth(i).click();
      await expect(radios.nth(i)).toBeChecked();
      await expect(happened).not.toHaveText(seen.at(-1) ?? "\u0000");
      seen.push((await happened.innerText()).trim());
    }
    expect(new Set(seen).size).toBe(4);
  });
});
