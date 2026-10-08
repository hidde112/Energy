import { test, expect } from "./fixtures/supabase";

test("navigation adapts without horizontal overflow", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const expectedNavigation = isMobile
    ? "Mobile navigation"
    : "Desktop navigation";
  await expect(
    page.getByRole("navigation", { name: expectedNavigation }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("missing configuration has an actionable setup state", async ({
  page,
}) => {
  await page.goto("/setup");
  await expect(
    page.getByRole("heading", { name: /connect energydex/i }),
  ).toBeVisible();
  await expect(page.getByText("NEXT_PUBLIC_SUPABASE_URL")).toBeVisible();
});
