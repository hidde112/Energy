import { test, expect } from "./fixtures/supabase";

test("guest onboarding persists the same profile across refresh", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByLabel(/^username$/i).fill("Pulse_Fox");
  await page.getByLabel(/display name/i).fill("Énergie Vos");
  await page.getByRole("button", { name: /create profile/i }).click();

  await expect(page).toHaveURL(/\/profile$/u);
  await expect(
    page.getByRole("heading", { name: "Énergie Vos" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("@pulse_fox")).toBeVisible();
});
