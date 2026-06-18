import { expect, test } from "@playwright/test";

test("skin shell renders without overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Workflow navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brew" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brew", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Bags" }).click();

  await expect(page.getByRole("heading", { name: "Bags" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bags", exact: true })).toHaveAttribute("aria-current", "page");

  const bodyBox = await page.locator("body").boundingBox();
  expect(bodyBox?.width).toBeGreaterThan(300);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});
