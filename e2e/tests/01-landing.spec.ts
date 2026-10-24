import { test, expect } from "@playwright/test";
import { collectConsoleErrors } from "./helpers";

// Errors caused by third-party embeds (YouTube etc.) are not the app's fault.
const THIRD_PARTY = /youtube|ytimg|googlevideo|doubleclick|google\.com|gstatic|fonts\.googleapis/i;

test.describe("Landing page", () => {
  test("loads without console errors", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/tcherly/i);
    await expect(page.getByRole("heading", { name: /Feedback to help teachers improve teaching practices/i })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const appErrors = errors.filter((e) => !THIRD_PARTY.test(e));
    expect(appErrors, appErrors.join("\n")).toEqual([]);
  });

  test("Login link opens the login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("Signup link opens the registration page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Signup", exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText("Online Feedback")).toBeVisible();
    await expect(page.getByRole("link", { name: /Get started/i }).first()).toBeVisible();
  });
});
