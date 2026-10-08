import { test, expect } from "./fixtures/supabase";

test("camera denial retains gallery and manual fallbacks", async ({ page }) => {
  await page.goto("/scan");
  await page.getByRole("button", { name: /start camera/i }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /camera|permission/i }),
  ).toContainText(/camera|permission/i);
  await expect(page.getByLabel(/choose can image/i)).toBeAttached();
  await expect(page.getByLabel(/barcode number/i)).toBeVisible();
});

test("another guest cannot read or confirm an owned scan", async ({
  browser,
  baseURL,
}) => {
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await ownerPage.goto(`${baseURL}/scan`);
  await ownerPage.getByLabel(/barcode number/i).fill("9002490100070");
  await ownerPage.getByRole("button", { name: /use barcode/i }).click();
  await ownerPage.waitForURL(/\/scan\/[0-9a-f-]+$/u);
  const scanUrl = ownerPage.url();
  const scanId = scanUrl.split("/").at(-1)!;

  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  const response = await strangerPage.goto(scanUrl);
  expect(response?.status()).toBe(404);
  const confirm = await strangerPage.request.post(
    `${baseURL}/api/scans/${scanId}/confirm`,
    {
      data: {
        idempotencyKey: "stranger-confirm",
        confirmation: { productId: "30000000-0000-0000-0000-000000000001" },
      },
    },
  );
  expect(confirm.status()).toBe(404);

  await owner.close();
  await stranger.close();
});
