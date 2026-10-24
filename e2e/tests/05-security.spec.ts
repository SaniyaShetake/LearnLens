import { test, expect, request as pwRequest, APIRequestContext } from "@playwright/test";
import {
  apiAddLesson,
  apiCreateCourse,
  apiLogin,
  apiSignupTeacher,
  auth,
  logSize,
  mailLinesSince,
  PASSWORD,
  uniqueName,
  waitForResetLink,
  YT_URL,
} from "./helpers";

import { BASE_URL } from "./constants";

/** GET the server-rendered reset page and POST a new password through it (with CSRF). */
async function submitResetForm(link: string, newPassword: string) {
  const ctx: APIRequestContext = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const path = new URL(link).pathname;
    const page = await ctx.get(path);
    const html = await page.text();
    const csrf = (html.match(/name="_csrf"\s+value="([^"]+)"/) || [])[1];
    const post = await ctx.post(path, {
      form: { _csrf: csrf || "", password: newPassword, confirm_password: newPassword },
      maxRedirects: 0,
    });
    return { getStatus: page.status(), hadForm: !!csrf, status: post.status(), body: await post.text(), location: post.headers()["location"] };
  } finally {
    await ctx.dispose();
  }
}

test.describe("Security (black-box HTTP)", () => {
  test("teacher B cannot delete or edit teacher A's lesson", async ({ request }) => {
    const a = await apiSignupTeacher(request);
    const b = await apiSignupTeacher(request);
    const course = await apiCreateCourse(request, a);
    const lesson = await apiAddLesson(request, a, course._id);

    const del = await request.delete(`/api/lessons/${lesson._id}`, { headers: auth(b) });
    expect([403, 404], `DELETE by other teacher returned ${del.status()}`).toContain(del.status());

    const put = await request.put(`/api/lessons/${lesson._id}`, {
      headers: auth(b),
      data: { name: "Hijacked by B", desc: "pwned", youtube_link: YT_URL },
    });
    expect([403, 404], `PUT by other teacher returned ${put.status()}`).toContain(put.status());

    // Lesson still exists, unchanged, for A.
    const own = await request.get(`/api/courses/${course._id}`, { headers: auth(a) });
    const ownBody = await own.json();
    const found = (ownBody.course.lessons as any[]).find((l) => l._id === lesson._id);
    expect(found, "lesson should still be listed for teacher A").toBeTruthy();
    expect(found.name).toBe(lesson.name);

    const pub = await request.get(`/api/lessons/${lesson.id}`);
    expect(pub.status()).toBe(200);
  });

  test("forgot-password ignores a spoofed Host header; reset link is single-use", async ({ request }) => {
    const t = await apiSignupTeacher(request);
    const offset = logSize();
    const res = await request.post("/api/auth/password/forgot", {
      data: { email: t.email },
      headers: { Host: "evil.example" },
    });
    expect(res.status()).toBeLessThan(500);

    const link = await waitForResetLink(offset, t.email);
    expect(link.startsWith(`${BASE_URL}/password/reset/`), `reset link was ${link}`).toBe(true);
    expect(link).not.toContain("evil.example");

    // First use succeeds.
    const newPw = "N3w-" + PASSWORD;
    const first = await submitResetForm(link, newPw);
    expect(first.getStatus).toBe(200);
    expect(first.hadForm).toBe(true);
    expect(first.status, first.body.slice(0, 300)).toBeLessThan(400);
    expect((await apiLogin(request, t.email, newPw)).status()).toBe(200);
    expect((await apiLogin(request, t.email, PASSWORD)).status()).not.toBe(200);

    // Second use of the same link must fail.
    const otherPw = "Other-" + PASSWORD;
    const second = await submitResetForm(link, otherPw);
    const secondOk = second.hadForm && second.status >= 300 && second.status < 400 && second.location === "/";
    expect(secondOk, `second use should fail: ${second.status} ${second.body.slice(0, 200)}`).toBe(false);
    expect((await apiLogin(request, t.email, otherPw)).status()).not.toBe(200);
    expect((await apiLogin(request, t.email, newPw)).status()).toBe(200);
  });

  test("forgot-password with a NoSQL operator as email sends no mail", async ({ request }) => {
    await apiSignupTeacher(request); // make sure at least one user exists
    const offset = logSize();
    const res = await request.post("/api/auth/password/forgot", {
      data: { email: { $ne: null } },
    });
    expect(res.status()).toBeLessThan(500);
    await new Promise((r) => setTimeout(r, 2_000));
    expect(mailLinesSince(offset), "no [mail] line expected").toEqual([]);
  });

  test("CORS preflight from a foreign origin gets no Access-Control-Allow-Origin", async ({ request }) => {
    for (const path of ["/api/auth/signin", "/api/courses/"]) {
      const res = await request.fetch(path, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,authorization",
        },
      });
      const acao = res.headers()["access-control-allow-origin"];
      expect(acao, `${path} ACAO=${acao}`).toBeUndefined();
    }
  });

  test("public lesson JSON does not leak bookmark questions/actions", async ({ request }) => {
    const t = await apiSignupTeacher(request, { feature_level: "advanced" });
    const course = await apiCreateCourse(request, t);
    const lesson = await apiAddLesson(request, t, course._id);

    const secretQ = uniqueName("SECRET-QUESTION");
    const secretA = uniqueName("SECRET-ACTION");
    const bm = await request.put(`/api/lessons/${lesson._id}/bookmark/add`, {
      headers: auth(t),
      data: { topic: "e2e topic", feedback_type: ["difficult"], time_from: 0, time_to: 1, activated: ["difficult"], threshold: 0 },
    });
    expect(bm.status(), await bm.text()).toBe(200);
    const bmBody = await bm.json();
    const bookmarkId = bmBody.current_bookmark?._id || bmBody.bookmarks?.[bmBody.bookmarks.length - 1]?._id;
    expect(bookmarkId).toBeTruthy();

    const q = await request.put(`/api/lessons/bookmark/${bookmarkId}/add-question`, {
      headers: auth(t),
      data: { question: { name: secretQ, action: "secret thoughts" } },
    });
    expect(q.status()).toBe(200);
    const a = await request.put(`/api/lessons/bookmark/${bookmarkId}/add-action`, {
      headers: auth(t),
      data: { action: { question: 0, action: secretA, future_action: "secret future" } },
    });
    expect(a.status()).toBe(200);

    // Sanity: the owner sees them on the (authenticated) dashboard endpoint.
    const own = await request.get(`/api/lessons/${lesson.id}/feedback?min=0`, { headers: auth(t) });
    expect(await own.text()).toContain(secretQ);

    const pub = await request.get(`/api/lessons/${lesson.id}`);
    expect(pub.status()).toBe(200);
    const text = await pub.text();
    expect(text).not.toContain(secretQ);
    expect(text).not.toContain(secretA);
    expect(text).not.toContain("secret thoughts");
    expect(text).not.toContain("secret future");
  });
});
