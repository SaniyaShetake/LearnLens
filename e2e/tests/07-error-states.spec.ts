import { test, expect } from "@playwright/test";
import { apiSignupTeacher, uiLogin } from "./helpers";

const NOT_FOUND_TEXT = "Could not find the page you're looking for.";

test.describe("Error states", () => {
  test("nonexistent course shows a friendly error (no profanity)", async ({ page, request }) => {
    const t = await apiSignupTeacher(request);
    await uiLogin(page, t.email, t.password);
    await page.goto("/c/0123456789abcdef01234567");
    await page.waitForLoadState("networkidle");
    const body = page.locator("body");
    await expect(body).not.toContainText(/fuck|shit|damn/i);
    await expect(body).toContainText(/not found|could not be found|could not find|couldn't find|doesn't exist|does not exist|no such course/i);
    await expect(page.getByRole("link", { name: /Back to dashboard/i }).or(page.getByRole("button", { name: /Back to dashboard/i }))).toBeVisible();
  });

  test("unknown route shows the 404 page (logged out)", async ({ page }) => {
    await page.goto("/this/route/does-not-exist");
    await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible();
    await expect(page.getByRole("img", { name: "not-found" })).toBeVisible();
    await page.getByRole("link", { name: /Back Home/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("unknown route shows the 404 page (logged in)", async ({ page, request }) => {
    const t = await apiSignupTeacher(request);
    await uiLogin(page, t.email, t.password);
    await page.goto("/definitely-not-a-page");
    await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible();
  });

  test("unknown API route returns JSON 404", async ({ request }) => {
    const res = await request.get("/api/does-not-exist");
    expect(res.status()).toBe(404);
    expect((await res.json()).success).toBe(false);
  });
});
