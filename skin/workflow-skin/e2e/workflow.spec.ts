import { expect, test } from "@playwright/test";

test("renders workflow navigation and switches pages", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Workflow navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brew" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brew" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Bags" }).click();

  await expect(page.getByRole("heading", { name: "Bags" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bags" })).toHaveAttribute("aria-current", "page");
});
