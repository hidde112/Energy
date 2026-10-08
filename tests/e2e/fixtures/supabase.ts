import { expect, test as base } from "@playwright/test";

export const test = base.extend<{
  manualBarcode: (value?: string) => Promise<void>;
}>({
  manualBarcode: async ({ page }, provide) => {
    await provide(async (value = "9002490100070") => {
      await page.getByLabel(/barcode number/i).fill(value);
      await page.getByRole("button", { name: /use barcode/i }).click();
    });
  },
});

export { expect };
