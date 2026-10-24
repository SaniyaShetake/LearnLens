import { test, expect, Page } from "@playwright/test";
import { PASSWORD, uniqueEmail, uniqueName } from "./helpers";

async function logoutViaMenu(page: Page) {
  await page.locator("#nav-profile-drop").click();
  await page.getByRole("button", { name: "Logout" }).or(page.getByText("Logout", { exact: true })).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("banner").getByRole("link", { name: "Login", exact: true })).toBeVisible();
}

test.describe("Teacher authentication", () => {
  test("signup -> dashboard -> logout -> login -> dashboard", async ({ page }) => {
    const email = uniqueEmail("ui-teacher");

    await page.goto("/register");
    await page.getByRole("link", { name: /Get started/i }).first().click();
    await expect(page).toHaveURL(/\/register\?mode=online/);

    await page.getByLabel(/^Name/).fill(uniqueName("UI Teacher"));
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel("Organization").fill("E2E University");
    await page.getByLabel("Advanced", { exact: true }).check({ force: true });
    await page.getByLabel("No", { exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Register", exact: true }).click();

    // Signed in right away: the nav shows the teacher menu.
    await expect(page.getByRole("banner").getByRole("link", { name: "Dashboard" })).toBeVisible();
    // Expected UX: land on the dashboard after signup (soft: keep the journey going).
    await expect.soft(page, "after signup the teacher should land on /dashboard").toHaveURL(/\/dashboard$/);
    if (!/\/dashboard$/.test(page.url())) await page.goto("/dashboard");
    await expect(page.getByText("Create a course")).toBeVisible();

    await logoutViaMenu(page);

    // Login through the form; expected to land on /dashboard.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByRole("banner").getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect.soft(page, "after login the teacher should land on /dashboard").toHaveURL(/\/dashboard$/);
    if (!/\/dashboard$/.test(page.url())) await page.goto("/dashboard");
    await expect(page.getByText("Create a course")).toBeVisible();
  });

  test("wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("nobody"));
    await page.getByPlaceholder("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(/incorrect|error/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("visiting /dashboard while logged out redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  });
});
