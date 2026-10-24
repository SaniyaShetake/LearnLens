import { test, expect } from "@playwright/test";
import { apiSignupTeacher, logSize, uiLogin, waitForResetLink } from "./helpers";

test.describe("Password reset (UI)", () => {
  test("forgot password -> link from mail log -> set new password -> login", async ({ page, request }) => {
    const t = await apiSignupTeacher(request);

    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/password\/forgot$/);

    const offset = logSize();
    await page.getByPlaceholder("Email").fill(t.email);
    await page.getByRole("button", { name: /Send Login Link/i }).click();
    await expect(page.getByRole("alert")).toContainText(/reset instructions|email/i);

    const link = await waitForResetLink(offset, t.email);
    await page.goto(link);
    // No "-" here: see the separate test below for the hyphen bug.
    const newPassword = "ResetE2ePassw0rd!";
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.locator("#new-password").fill(newPassword);
    await page.locator("#confirm-new-password").fill(newPassword);
    const submitted = page.waitForResponse((r) => r.url().includes("/password/reset/") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm" }).click();
    const postRes = await submitted;
    expect(postRes.status(), `reset POST -> ${postRes.status()} ${(await postRes.text().catch(() => "")).slice(0, 300)}`).toBe(302);
    await expect(page).toHaveURL(/\/$/);

    await uiLogin(page, t.email, newPassword);
    await expect(page.getByText("Create a course")).toBeVisible();
  });

  test("reset page accepts a password with '-' (allowed at signup)", async ({ page, request }) => {
    // The signup form/API accept any 8-64 char password; the reset page's client-side
    // regex must not reject characters such as '-' that signup allowed.
    const t = await apiSignupTeacher(request);
    const offset = logSize();
    await request.post("/api/auth/password/forgot", { data: { email: t.email } });
    const link = await waitForResetLink(offset, t.email);
    await page.goto(link);
    const newPassword = "New-Pass-word-123";
    await page.locator("#new-password").fill(newPassword);
    await page.locator("#confirm-new-password").fill(newPassword);
    const submitted = page.waitForResponse((r) => r.url().includes("/password/reset/") && r.request().method() === "POST", { timeout: 5_000 }).catch(() => null);
    await page.getByRole("button", { name: "Confirm" }).click();
    const postRes = await submitted;
    const shownError = (await page.locator("#error-div").isVisible()) ? await page.locator("#error-div").innerText() : "";
    expect(postRes, `form was not submitted; page says: "${shownError}"`).not.toBeNull();
    expect(postRes!.status()).toBe(302);
  });
});
