import { test, expect } from "@playwright/test";
import { apiSignupTeacher, skipTourIfShown, uiLogin, uniqueName, YT_URL } from "./helpers";

test.describe("Course & lesson management (teacher)", () => {
  test("create course, add lesson, dashboard bookmark/question/action, edit course, delete lesson", async ({ page, request }) => {
    test.setTimeout(180_000);
    const teacher = await apiSignupTeacher(request, { feature_level: "advanced" });
    await uiLogin(page, teacher.email, teacher.password);

    // --- create course -----------------------------------------------------
    const courseName = uniqueName("Course");
    await page.getByLabel("Create a course").fill(courseName);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/\/c\/[0-9a-f]{24}$/);
    await expect(page.locator(".course-name")).toContainText(courseName);
    await expect(page.getByText("You haven't posted any lessons yet.")).toBeVisible();
    const courseUrl = page.url();

    // --- add lesson (YouTube) ---------------------------------------------
    const lessonName = uniqueName("Lesson");
    await page.getByRole("button", { name: /New Lesson/ }).click();
    const addModal = page.getByRole("dialog");
    await addModal.getByLabel("Title").fill(lessonName);
    await addModal.getByLabel(/YouTube URL/).fill(YT_URL);
    await addModal.getByLabel("Description").fill("Lesson created by the e2e suite");
    const addResp = page.waitForResponse((r) => /\/api\/courses\/[0-9a-f]{24}\/lesson$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await addModal.getByRole("button", { name: "Submit" }).click();
    const resp = await addResp;
    if (resp.status() === 400) {
      const body = await resp.text();
      test.skip(/youtube|video|duration/i.test(body), `YouTube metadata fetch failed on server: ${body.slice(0, 200)}`);
    }
    expect(resp.status()).toBe(200);
    const { lesson } = await resp.json();
    const row = page.getByRole("row", { name: new RegExp(lessonName) });
    await expect(row).toBeVisible();

    // The "Teacher Dashboard" button links to /l/<slug>/dashboard
    const dashHref = await row.locator(`a[href="/l/${lesson.id}/dashboard"]`).getAttribute("href");
    expect(dashHref).toBe(`/l/${lesson.id}/dashboard`);

    // --- edit course ----------------------------------------------------------
    const newCourseName = uniqueName("Renamed");
    await page.getByRole("button", { name: /Options/ }).first().click();
    await page.locator(".dropdown-menu.show").getByText("Edit", { exact: true }).click();
    const editModal = page.getByRole("dialog");
    await editModal.getByLabel("Course name").fill(newCourseName);
    await editModal.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator(".course-name")).toContainText(newCourseName);
    await page.reload();
    await expect(page.locator(".course-name")).toContainText(newCourseName);

    // --- lesson dashboard ------------------------------------------------------
    await page.goto(dashHref!);
    await skipTourIfShown(page);
    await expect(page).toHaveURL(new RegExp(`/l/${lesson.id}/dashboard`));
    await expect(page.getByText("Your bookmarks")).toBeVisible({ timeout: 20_000 });

    // bookmark
    const topic = uniqueName("Topic");
    await page.getByPlaceholder("Enter topic name here").first().fill(topic);
    await page.locator(".td-feedback-types").getByText("Difficult", { exact: true }).click();
    const bmResp = page.waitForResponse((r) => r.url().includes(`/bookmark/add`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Add Bookmark" }).click();
    expect((await bmResp).status()).toBe(200);
    await expect(page.locator(".bookmark-list .bm-topic", { hasText: topic })).toBeVisible();

    // question
    const question = uniqueName("Why did engagement drop");
    await page.getByText("Add Question", { exact: true }).click();
    const qModal = page.getByRole("dialog").filter({ hasText: "Add questions" });
    await qModal.locator('textarea[name="name"]').fill(question);
    await qModal.locator('textarea[name="action"]').fill("Add a worked example");
    const qResp = page.waitForResponse((r) => r.url().includes("/add-question"));
    await qModal.getByRole("button", { name: "Save Changes" }).click();
    expect((await qResp).status()).toBe(200);
    await expect(page.locator(".td-questions").getByText(question)).toBeVisible();

    // action
    const action = uniqueName("Recorded a worked example");
    await page.locator(".td-actions").getByText("Add Action", { exact: true }).first().click();
    const aModal = page.getByRole("dialog").filter({ hasText: "Add action" });
    await aModal.locator("div[class*='control']").first().click();
    await page.getByText(question, { exact: true }).last().click();
    await aModal.locator('textarea[name="action"]').fill(action);
    await aModal.locator('textarea[name="future_action"]').fill("Use it next semester");
    const aResp = page.waitForResponse((r) => r.url().includes("/add-action"));
    await aModal.getByRole("button", { name: "Save Changes" }).click();
    expect((await aResp).status()).toBe(200);
    await expect(page.locator(".td-actions").getByText(action).first()).toBeVisible();

    // persisted after reload
    await page.reload();
    await skipTourIfShown(page);
    await expect(page.locator(".bookmark-list .bm-topic", { hasText: topic })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".td-questions").getByText(question)).toBeVisible();
    await expect(page.locator(".td-actions").getByText(action).first()).toBeVisible();

    // --- delete lesson -------------------------------------------------------
    await page.goto(courseUrl);
    const row2 = page.getByRole("row", { name: new RegExp(lessonName) });
    await expect(row2).toBeVisible();
    await row2.locator(".btn-settings").click();
    await page.locator(".dropdown-menu.show").getByText("Delete", { exact: true }).click();
    const delModal = page.getByRole("dialog");
    await expect(delModal.getByText("Are you sure?")).toBeVisible();
    const delResp = page.waitForResponse((r) => r.url().endsWith(`/api/lessons/${lesson._id}`) && r.request().method() === "DELETE");
    await delModal.getByRole("button", { name: "Delete" }).click();
    expect((await delResp).status()).toBe(200);
    await expect(row2).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("You haven't posted any lessons yet.")).toBeVisible();
  });
});
