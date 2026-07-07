import { test, expect } from "@playwright/test";

test("main menu renders and links to the game", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Backrooms" })).toBeVisible();
  await expect(page.getByRole("link", { name: /start game/i })).toBeVisible();
});

test("settings page renders controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Master Volume")).toBeVisible();
});

test("game page mounts a canvas", async ({ page }) => {
  await page.goto("/game");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
});
