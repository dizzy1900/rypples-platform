import { expect, test } from "@playwright/test";
import { openDecisions, resetDemo, settled } from "./helpers";

test("session isolation: actions in A are not visible in B", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  await a.goto("/os");
  await b.goto("/os");
  await expect(openDecisions(a)).toHaveText("3 open");
  await expect(openDecisions(b)).toHaveText("3 open");

  await a.goto("/os/companies/desolenator");
  const saved = settled(a);
  await a.getByRole("button", { name: "Discuss at the board" }).click();
  await saved;
  await expect(a.getByRole("button", { name: "Discuss at the board" })).toHaveCount(0);

  await a.goto("/os");
  await expect(openDecisions(a)).toHaveText("2 open");

  await b.goto("/os");
  await expect(openDecisions(b)).toHaveText("3 open");
  await b.goto("/os/companies/desolenator");
  await expect(b.getByRole("button", { name: "Discuss at the board" })).toBeVisible();

  // And a different cookie really is a different session.
  const cookie = async (p: typeof a) => (await p.context().cookies()).find((c) => c.name === "rp_demo")?.value;
  expect(await cookie(a)).toBeTruthy();
  expect(await cookie(a)).not.toBe(await cookie(b));

  await a.context().close();
  await b.context().close();
});

test("Reset demo removes a session action and rotates the session", async ({ page }) => {
  await page.goto("/os/companies/desolenator");
  const saved = settled(page);
  await page.getByRole("button", { name: "Discuss at the board" }).click();
  await saved;
  await expect(page.getByRole("button", { name: "Discuss at the board" })).toHaveCount(0);

  const cookie = async () => (await page.context().cookies()).find((c) => c.name === "rp_demo")?.value;
  const before = await cookie();

  await resetDemo(page);
  await expect(page.getByRole("button", { name: "Discuss at the board" })).toBeVisible();
  expect(await cookie()).not.toBe(before);

  await page.goto("/os");
  await expect(openDecisions(page)).toHaveText("3 open");
});
