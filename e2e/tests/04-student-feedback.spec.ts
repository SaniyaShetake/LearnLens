import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import {
  apiAddLesson,
  apiCreateCourse,
  apiSignupTeacher,
  auth,
  PASSWORD,
  skipTourIfShown,
  uiLogin,
  uniqueEmail,
  uniqueName,
} from "./helpers";
import { RESEARCHER } from "./constants";

type Options = Record<"difficult" | "easy" | "boring" | "engaging", { id: string; name: string }[]>;

const REACTIONS: Array<{ key: keyof Options; label: string }> = [
  { key: "difficult", label: "Difficult" },
  { key: "easy", label: "Easy" },
  { key: "boring", label: "Boring" },
  { key: "engaging", label: "Engaging" },
];

/** Starts the embedded YouTube player; returns true if playback started. */
async function startVideo(page: Page): Promise<boolean> {
  const played = page
    .waitForRequest((r) => r.url().includes("/log") && r.method() === "POST" && (r.postData() || "").includes('"play"'), { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  const frame = page.frameLocator("iframe").first();
  try {
    await frame.locator(".ytp-large-play-button, .ytp-play-button").first().click({ timeout: 20_000 });
  } catch {
    await page.locator("iframe").first().click({ timeout: 5_000 }).catch(() => {});
  }
  return played;
}

test.describe("Student feedback flow", () => {
  test("student signs up on /l/<slug>, reacts to the video; teacher sees it; researcher exports Excel", async ({ browser, request }) => {
    test.setTimeout(240_000);

    // Teacher prepares a lesson (via HTTP, it's setup for this journey).
    const teacher = await apiSignupTeacher(request, { feature_level: "advanced" });
    const course = await apiCreateCourse(request, teacher);
    const lesson = await apiAddLesson(request, teacher, course._id);
    const options: Options = (await (await request.get("/api/misc/columns")).json()).options;

    // ---------------- Student (separate browser context) ----------------------
    const studentCtx = await browser.newContext();
    const student = await studentCtx.newPage();
    await student.goto(`/l/${lesson.id}`);
    await expect(student.getByRole("heading", { name: "Login as student" })).toBeVisible();

    await student.getByRole("link", { name: "Register" }).click();
    await expect(student.getByRole("heading", { name: "Register as student" })).toBeVisible();
    const studentEmail = uniqueEmail("student");
    await student.getByLabel(/^Name/).fill(uniqueName("Student"));
    await student.getByLabel(/^Email/).fill(studentEmail);
    await student.getByLabel(/^Password/).fill(PASSWORD);
    await student.getByLabel(/^Confirm Password/).fill(PASSWORD);
    const signup = student.waitForResponse((r) => r.url().includes("/api/auth/student/signup"));
    await student.getByRole("button", { name: "Register", exact: true }).click();
    expect((await signup).status()).toBe(200);

    // After registering the student should stay on the lesson and see the player.
    await expect.soft(student, "student should stay on the lesson page after signup").toHaveURL(new RegExp(`/l/${lesson.id}(#.*)?$`));
    if (!new RegExp(`/l/${lesson.id}(#.*)?$`).test(student.url())) {
      await student.goto(`/l/${lesson.id}`);
    }
    // If the session did not survive, log in through the student login form.
    const loginHeading = student.getByRole("heading", { name: "Login as student" });
    const recorder = student.getByText("I find the lecture");
    await expect(loginHeading.or(recorder)).toBeVisible();
    if (await loginHeading.isVisible()) {
      await student.getByLabel("Email").fill(studentEmail);
      await student.getByPlaceholder("Password").fill(PASSWORD);
      await student.getByRole("button", { name: "Login", exact: true }).click();
    }
    await expect(recorder).toBeVisible();

    // Play, then skip forward in the video.
    const played = await startVideo(student);
    test.skip(!played, "YouTube player did not start in headless Chromium (no playback => no timestamps)");
    await student.waitForTimeout(4_000);
    await student.frameLocator("iframe").first().locator("video").press("ArrowRight").catch(() => {});
    await student.waitForTimeout(2_000);

    // Submit Difficult / Easy / Boring / Engaging with a sub-reason each.
    for (const { key, label } of REACTIONS) {
      await student.locator(".feedback-recorder").getByText(label, { exact: true }).click();
      const reason = options[key][0].name;
      const posted = student.waitForResponse((r) => r.url().endsWith(`/api/lessons/${lesson.id}`) && r.request().method() === "POST");
      await student.locator(".feedback-options").getByText(reason, { exact: true }).click();
      const res = await posted;
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.newFeedback[key]).toBe(true);
      expect(body.newFeedback.details[key]).toBe(options[key][0].id);
      expect(body.newFeedback.seconds, "feedback should carry a video timestamp").toBeGreaterThan(0);
      await expect(student.getByText("I find the lecture")).toBeVisible();
      await student.waitForTimeout(1_500);
    }
    await studentCtx.close();

    // ---------------- Teacher sees the feedback ---------------------------------
    const fb = await request.get(`/api/lessons/${lesson.id}/feedback?min=0&max=${lesson.minutes}`, { headers: auth(teacher) });
    expect(fb.status()).toBe(200);
    const fbBody = await fb.json();
    for (const { key } of REACTIONS) {
      expect(fbBody.feedback.participation_all[key].length, `participation for ${key}`).toBe(1);
    }

    const teacherCtx = await browser.newContext({ acceptDownloads: true });
    const tpage = await teacherCtx.newPage();
    await uiLogin(tpage, teacher.email, teacher.password);
    await tpage.goto(`/l/${lesson.id}/dashboard`);
    await skipTourIfShown(tpage);
    await expect(tpage.getByText("Student Participation")).toBeVisible({ timeout: 20_000 });
    await expect(tpage.locator(".td-participation").locator("tspan.tspan-gauge").last()).toHaveText(/1\s*\/\s*1/);

    await teacherCtx.close();

    // ---------------- Excel export (researcher-only by design) ------------------
    // Teachers have no export: the endpoint must reject a teacher token.
    const teacherExport = await request.get(`/api/lessons/${lesson.id}/feedback-export`, { headers: auth(teacher) });
    expect([401, 403]).toContain(teacherExport.status());

    const rCtx = await browser.newContext({ acceptDownloads: true });
    const rpage = await rCtx.newPage();
    await rpage.goto("/researcher");
    await expect(rpage.getByRole("heading", { name: "Researcher Login" })).toBeVisible();
    await rpage.getByLabel("Email").fill(RESEARCHER.email);
    await rpage.getByPlaceholder("Password").fill(RESEARCHER.password);
    await rpage.getByRole("button", { name: "Login", exact: true }).click();
    await expect(rpage.getByRole("heading", { name: "Researcher dashboard" })).toBeVisible();
    const lessonRow = rpage.getByRole("row").filter({ hasText: lesson.id });
    await expect(lessonRow).toBeVisible({ timeout: 20_000 });
    const [download] = await Promise.all([rpage.waitForEvent("download"), lessonRow.getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    const buf = fs.readFileSync(await download.path());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
    await rCtx.close();
  });
});
