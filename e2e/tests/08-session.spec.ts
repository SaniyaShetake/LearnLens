import { test, expect } from "@playwright/test";
import { apiSignupTeacher, uiLogin } from "./helpers";

test.describe("Session robustness", () => {
  test("reloading after login keeps the teacher logged in (refresh cookie)", async ({ page, context, request }) => {
    const t = await apiSignupTeacher(request);
    await uiLogin(page, t.email, t.password);
    await expect(page.getByText("Create a course")).toBeVisible();

    const cookies = await context.cookies();
    const refresh = cookies.find((c) => c.name === "debe_token");
    expect(refresh, "refresh-token cookie should be set").toBeTruthy();
    expect(refresh!.httpOnly).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Create a course")).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Dashboard" })).toBeVisible();

    // A brand-new tab in the same context is logged in as well.
    const page2 = await context.newPage();
    await page2.goto("/dashboard");
    await expect(page2.getByText("Create a course")).toBeVisible();
  });
});
