import { test, expect } from "@playwright/test";

test("main menu renders and links to the game", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Backrooms" })).toBeVisible();
  await expect(page.getByRole("link", { name: /continue/i })).toBeVisible();
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

test("game survives preload + scene start without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto("/game");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
  // Let PreloadScene bake every texture (all level styles, skins and monster
  // art sets) and MainScene run its first seconds of updates — any missing
  // texture key or broken spawn path throws here.
  await page.waitForTimeout(8_000);
  expect(errors).toEqual([]);
});

test("skin selector shows live sprite previews for every skin", async ({
  page,
}) => {
  await page.goto("/skins");
  const cards = page.locator(".skin-card");
  await expect(cards.first()).toBeVisible();
  const cardCount = await cards.count();
  await expect(page.locator(".skin-card__preview")).toHaveCount(cardCount);
  // Wardrobe skins (police etc.) are equippable without any progress.
  const police = page.locator(".skin-card", { hasText: "Police Officer" });
  await expect(police).toBeEnabled();
  await police.click();
  await expect(police).toHaveClass(/skin-card--equipped/);
});
