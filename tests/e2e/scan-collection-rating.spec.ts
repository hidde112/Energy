import { test, expect } from "./fixtures/supabase";

test("manual barcode confirms into collection and accepts a current rating", async ({
  page,
  manualBarcode,
}) => {
  await page.goto("/scan");
  await manualBarcode();
  await expect(page).toHaveURL(/\/scan\/[0-9a-f-]+$/u);
  await expect(page.getByText("Red Bull Energy Drink")).toBeVisible();

  await page.getByRole("button", { name: /confirm product/i }).click();
  await expect(page.getByRole("status")).toContainText(
    /added to your collection/i,
  );

  await page.goto("/collection");
  await expect(page.getByText("Red Bull Energy Drink")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Red Bull Energy Drink")).toBeVisible();
  await page.goto("/products/30000000-0000-0000-0000-000000000001/rate");
  await page.getByLabel(/overall rating/i).fill("8.5");
  await page.getByLabel(/record a new tasting/i).check();
  await page.getByRole("button", { name: /save rating/i }).click();
  await expect(page.getByRole("status")).toHaveText(/rating saved/i);
  await page.reload();
  await expect(page.getByLabel(/overall rating/i)).toHaveValue("8.5");
});

test("confirmation retry with the same key is idempotent", async ({
  page,
  manualBarcode,
}) => {
  await page.goto("/scan");
  await manualBarcode();
  await page.waitForURL(/\/scan\/[0-9a-f-]+$/u);
  const scanId = page.url().split("/").at(-1)!;
  const request = {
    data: {
      idempotencyKey: "repeat-confirmation-key",
      confirmation: {
        productId: "30000000-0000-0000-0000-000000000001",
        collectionStatus: "tried",
      },
    },
  };
  const first = await page.request.post(
    `/api/scans/${scanId}/confirm`,
    request,
  );
  const second = await page.request.post(
    `/api/scans/${scanId}/confirm`,
    request,
  );
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);
  expect(await second.json()).toEqual(await first.json());
});

test("image fallback yields at most three deterministic candidates", async ({
  page,
}) => {
  await page.goto("/scan");
  await page.getByLabel(/choose can image/i).setInputFiles({
    name: "unknown-can.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });

  await expect(page).toHaveURL(/\/scan\/[0-9a-f-]+$/u);
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByText(/medium confidence/i)).toBeVisible();
});

test("provider outage leaves manual recovery usable", async ({
  page,
  manualBarcode,
}) => {
  await page.goto("/scan");
  await page.getByLabel(/choose can image/i).setInputFiles({
    name: "provider-outage.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /temporarily unavailable/i }),
  ).toContainText(/temporarily unavailable/i);

  await manualBarcode();
  await expect(page).toHaveURL(/\/scan\/[0-9a-f-]+$/u);
});
