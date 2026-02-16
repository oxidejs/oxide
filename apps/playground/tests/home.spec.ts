import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should increase counter", async ({ page }) => {
    await page.goto("/");
  });
});
