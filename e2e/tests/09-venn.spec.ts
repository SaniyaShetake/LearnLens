import { test, expect, APIRequestContext, Page } from "@playwright/test";
import { apiAddLesson, apiCreateCourse, apiSignupStudent, apiSignupTeacher, auth, collectConsoleErrors, skipTourIfShown, uiLogin } from "./helpers";

// Errors caused by third-party embeds (YouTube etc.) are not the app's fault.
const THIRD_PARTY = /youtube|ytimg|googlevideo|doubleclick|google\.com|gstatic|fonts\.googleapis/i;

type Kind = "difficult" | "easy" | "boring" | "engaging";

/** Posts one feedback click per kind for a fresh student, at `seconds` into the video. */
async function studentReacts(request: APIRequestContext, lessonSlug: string, kinds: Kind[], seconds: number) {
  const student = await apiSignupStudent(request);
  for (const [i, kind] of kinds.entries()) {
    const res = await request.post(`/api/lessons/${lessonSlug}`, {
      data: { feedback: kind, timestamp: seconds + i * 5, date_client: new Date().toISOString() },
      headers: { Authorization: student.token },
    });
    const text = await res.text();
    expect(res.status(), text).toBe(200);
    expect(JSON.parse(text).success, text).toBe(true);
  }
}

async function visibleBox(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = (el as SVGGraphicsElement).getBoundingClientRect();
      return { w: r.width, h: r.height, text: el.textContent || "" };
    })
  );
}

test.describe("Venn diagram (DEBE Interactions)", () => {
  test("renders overlapping feedback populations as SVG areas with labels and tooltip", async ({ browser, request }) => {
    test.setTimeout(180_000);
    const teacher = await apiSignupTeacher(request, { feature_level: "advanced" });
    const course = await apiCreateCourse(request, teacher);
    const lesson = await apiAddLesson(request, teacher, course._id);
    expect(lesson.minutes, "lesson needs >= 3 minutes for the seeded timestamps").toBeGreaterThanOrEqual(3);

    // Overlapping populations (timestamps in minute 2-3, inside the default 1..N range and the
    // server's start/end ignore thresholds):
    //   difficult: S1 S2 S4 (3)   easy: S1 S3 S4 (3)   difficult∩easy: S1 S4 (2)
    //   boring:    S1 S2 S3 (3)   engaging: S2 S3 (2)  boring∩engaging: S2 S3 (2)
    await studentReacts(request, lesson.id, ["difficult", "easy", "boring"], 70);
    await studentReacts(request, lesson.id, ["difficult", "boring", "engaging"], 80);
    await studentReacts(request, lesson.id, ["boring", "engaging", "easy"], 90);
    await studentReacts(request, lesson.id, ["difficult", "easy"], 100);

    const fb = await request.get(`/api/lessons/${lesson.id}/feedback`, { headers: auth(teacher) });
    expect(fb.status()).toBe(200);
    const venn = (await fb.json()).feedback.venn;
    expect(venn).toMatchObject({ difficult: 3, easy: 3, boring: 3, engaging: 2, difficult_easy: 2, boring_engaging: 2 });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = collectConsoleErrors(page);
    await uiLogin(page, teacher.email, teacher.password);
    await page.goto(`/l/${lesson.id}/dashboard`);
    await skipTourIfShown(page);
    await expect(page.getByText("DEBE Interactions")).toBeVisible({ timeout: 20_000 });

    // View 1 (default): "Difficult - Easy" and "Boring - Engaging".
    for (const [side, caption] of [
      ["left", "Difficult - Easy"],
      ["right", "Boring - Engaging"],
    ]) {
      const container = `.td-venn-${side} .venn-container`;
      await expect(page.locator(container).getByText(caption)).toBeVisible();
      await expect(page.locator(`${container} svg g.venn-area path`).first()).toBeVisible();
      const paths = await visibleBox(page, `${container} svg g.venn-area path`);
      // 2 circles + 1 intersection each
      expect(paths.length, `${caption}: venn areas`).toBe(3);
      for (const p of paths) {
        expect(p.w, `${caption}: path width`).toBeGreaterThan(0);
        expect(p.h, `${caption}: path height`).toBeGreaterThan(0);
      }
      const svgBox = await page.locator(`${container} svg`).boundingBox();
      expect(svgBox && svgBox.width > 0 && svgBox.height > 0, `${caption}: svg has size`).toBe(true);
      const labels = (await visibleBox(page, `${container} svg g.venn-area text`)).filter((t) => t.text.trim());
      expect(labels.map((l) => l.text.trim()).sort(), `${caption}: area labels`).toEqual(
        side === "left" ? ["2", "3", "3"] : ["2", "2", "3"]
      );
      for (const l of labels) expect(l.w * l.h, `${caption}: label "${l.text}" has size`).toBeGreaterThan(0);
    }

    // Hovering an area shows the tooltip with the set names and student count.
    const leftArea = page.locator(".td-venn-left svg g.venn-area path").first();
    await leftArea.hover({ force: true });
    const tooltip = page.locator("body > .venn-tooltip.set3");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(/^(Difficult|Easy)(, (Difficult|Easy))? - \d+ students$/);

    // View 2: three-set diagrams.
    await page.getByText("View 2", { exact: true }).click();
    await expect(page.locator(".td-venn-left .venn-container").getByText("Engaging - Difficult - Boring")).toBeVisible();
    await expect(page.locator(".td-venn-right .venn-container").getByText("Engaging - Easy - Boring")).toBeVisible();
    for (const side of ["left", "right"]) {
      const paths = await visibleBox(page, `.td-venn-${side} svg g.venn-area path`);
      expect(paths.length, `view 2 ${side}: venn areas`).toBeGreaterThanOrEqual(3);
      for (const p of paths) expect(p.w * p.h).toBeGreaterThan(0);
    }

    await page.waitForTimeout(500);
    const appErrors = errors.filter((e) => !THIRD_PARTY.test(e));
    expect(appErrors, appErrors.join("\n")).toEqual([]);
    await ctx.close();
  });
});
