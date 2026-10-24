import { test, expect, Page, BrowserContext } from "@playwright/test";
import { apiAddLesson, apiCreateCourse, apiSignupTeacher, uiLogin } from "./helpers";
import { BASE_URL } from "./constants";

// Every client route from client/src/App.jsx is visited; each is a React.lazy() chunk after
// route-level code splitting, so a broken chunk shows up as a failed request or a page error.
const THIRD_PARTY = /youtube|ytimg|googlevideo|doubleclick|google\.com|gstatic|fonts\.googleapis/i;
const CHUNK_ERROR = /dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed|MIME type/i;

interface Problems {
  pageErrors: string[];
  failed: string[];
  badStatus: string[];
  chunkConsole: string[];
}

function watch(ctx: BrowserContext): Problems {
  const p: Problems = { pageErrors: [], failed: [], badStatus: [], chunkConsole: [] };
  const own = (url: string) => url.startsWith(BASE_URL);
  ctx.on("page", (page) => attach(page, p, own));
  return p;
}

function attach(page: Page, p: Problems, own: (u: string) => boolean) {
  page.on("pageerror", (err) => p.pageErrors.push(`${page.url()} :: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && CHUNK_ERROR.test(msg.text())) p.chunkConsole.push(`${page.url()} :: ${msg.text()}`);
  });
  page.on("requestfailed", (r) => {
    if (!own(r.url())) return;
    p.failed.push(`${page.url()} :: ${r.method()} ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    // Static assets (JS/CSS chunks, images) must never 4xx/5xx.
    if (own(url) && /\/static\//.test(url) && r.status() >= 400) p.badStatus.push(`${page.url()} :: ${r.status()} ${url}`);
  });
}

async function visit(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), `${path} document status`).toBeLessThan(400);
  // Let Suspense resolve the lazy chunk and the page settle (no navigation while chunks are in flight).
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await expect(page.locator("#tcherly"), `${path} renders something`).not.toBeEmpty();
  await page.waitForTimeout(300);
}

function assertClean(p: Problems) {
  const pageErrors = p.pageErrors.filter((e) => !THIRD_PARTY.test(e));
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(p.chunkConsole, `chunk load errors:\n${p.chunkConsole.join("\n")}`).toEqual([]);
  expect(p.failed, `failed requests:\n${p.failed.join("\n")}`).toEqual([]);
  expect(p.badStatus, `static asset errors:\n${p.badStatus.join("\n")}`).toEqual([]);
}

test.describe("Route sweep", () => {
  test("logged out: every guest route loads its chunk without errors", async ({ browser, request }) => {
    test.setTimeout(180_000);
    // A real lesson slug for /l/:id (student login page); protected paths just need to redirect.
    const teacher = await apiSignupTeacher(request);
    const course = await apiCreateCourse(request, teacher);
    const lesson = await apiAddLesson(request, teacher, course._id);

    const ctx = await browser.newContext();
    const problems = watch(ctx);
    const page = await ctx.newPage();

    const guestRoutes = [
      "/",
      "/login",
      "/register",
      "/password/forgot",
      "/password/reset",
      `/l/${lesson.id}`,
      "/research",
      "/guidelines",
      "/introduction",
      "/terms",
      "/intro",
      "/researcher",
      "/no-such-page-e2e",
    ];
    for (const path of guestRoutes) await visit(page, path);

    // Protected paths send logged-out visitors to /login.
    const protectedRoutes = ["/dashboard", "/instructions", `/c/${course._id}`, `/l/${lesson.id}/dashboard`, "/tour"];
    for (const path of protectedRoutes) {
      await visit(page, path);
      await expect(page, `${path} -> /login`).toHaveURL(/\/login$/);
    }

    assertClean(problems);
    await ctx.close();
  });

  test("logged-in teacher: every route loads its chunk without errors", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const teacher = await apiSignupTeacher(request, { feature_level: "advanced" });
    const course = await apiCreateCourse(request, teacher);
    const lesson = await apiAddLesson(request, teacher, course._id);

    const ctx = await browser.newContext();
    const problems = watch(ctx);
    const page = await ctx.newPage();
    await uiLogin(page, teacher.email, teacher.password);

    const teacherRoutes = [
      "/dashboard",
      "/",
      "/research",
      "/guidelines",
      "/instructions",
      `/c/${course._id}`,
      `/l/${lesson.id}/dashboard`,
      `/l/${lesson.id}`,
      "/tour",
      "/terms",
      "/intro",
      "/introduction",
      "/researcher",
      "/no-such-page-e2e",
    ];
    for (const path of teacherRoutes) await visit(page, path);

    // Guest-only paths redirect a logged-in teacher.
    for (const path of ["/login", "/register", "/password/forgot"]) {
      await visit(page, path);
      await expect(page, `${path} redirects away`).not.toHaveURL(new RegExp(`${path}$`));
    }

    assertClean(problems);
    await ctx.close();
  });
});
