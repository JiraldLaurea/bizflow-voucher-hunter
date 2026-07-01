import { test, expect } from "@playwright/test";

test("public voucher hunt screen renders expected reference flow", async ({ page }) => {
  await page.goto("/campaign/july-dinner");
  await expect(page.getByRole("heading", { name: "BizFlow Voucher Hunt" })).toBeVisible();
  await expect(page.getByText("Step 1 of 8")).toBeVisible();
  await expect(page.getByRole("link", { name: "Let's Hunt!" })).toBeVisible();

  await page.goto("/campaign/july-dinner/date");
  await expect(page.getByText("Step 2 of 8")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Select Date" })).toBeVisible();
});
