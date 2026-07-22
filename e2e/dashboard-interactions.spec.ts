import { expect, test } from "@playwright/test";

test("staff dashboard remains interactive across repeated navigation", async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/login");
  const staffFill = page.getByRole("button", { name: "Fill staff credentials" });
  test.skip(!(await staffFill.isVisible()), "Development staff credentials are not exposed");
  await staffFill.click();
  await page.getByRole("button", { name: "Sign in to Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator(".dashboard-interaction-curtain")).toHaveCount(0);

  const destinations = ["Slots", "Vouchers", "Rewards Network", "Staff Validation", "Dashboard"];
  for (let round = 0; round < 12; round += 1) {
    for (const destination of destinations) {
      const link = page.getByRole("link", { name: destination, exact: true });
      await link.click();
      await page.waitForLoadState("load");
      await expect(link).toHaveClass(/active/);
      await expect(page.locator(".dashboard-interaction-curtain")).toHaveCount(0);
      await expect(page.locator(".modal-overlay")).toHaveCount(0);
    }
  }

  await page.getByRole("link", { name: "Vouchers", exact: true }).click();
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: "Request Benefit Tier" }).click();
  await expect(page.getByRole("dialog", { name: "Request Benefit Tier" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("staff controls hydrate after consecutive sidebar transitions", async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText;
    // A full-document sidebar navigation intentionally cancels any stale RSC
    // request left by the page being replaced. Keep reporting actual failures.
    if (errorText !== "net::ERR_ABORTED") {
      failedRequests.push(`${request.method()} ${request.url()}: ${errorText}`);
    }
  });

  await page.goto("/login");
  const staffFill = page.getByRole("button", { name: "Fill staff credentials" });
  test.skip(!(await staffFill.isVisible()), "Development staff credentials are not exposed");
  await staffFill.click();
  await page.getByRole("button", { name: "Sign in to Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const destination of ["Rewards Network", "Staff Validation", "Vouchers"]) {
    await page.getByRole("link", { name: destination, exact: true }).click();
    await expect(page.getByRole("link", { name: destination, exact: true })).toHaveClass(/active/);
  }

  await page.getByRole("button", { name: "Request Benefit Tier" }).click();
  await expect(page.getByRole("dialog", { name: "Request Benefit Tier" })).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
