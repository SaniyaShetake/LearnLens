import { APIRequestContext, Page, expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

export const SERVER_LOG = process.env.E2E_SERVER_LOG || path.join(__dirname, "..", ".server.log");
export const YT_URL = process.env.E2E_YT_URL || "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
export const PASSWORD = "E2e-Passw0rd!";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let counter = 0;

/** Unique, undeliverable (RFC 2606) email per call. */
export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}.${RUN_ID}.${counter}@example.test`;
}

export function uniqueName(prefix = "Name") {
  counter += 1;
  return `${prefix} ${RUN_ID} ${counter}`;
}

// ---------------------------------------------------------------------------
// Server log / mail helpers
// ---------------------------------------------------------------------------

export function logSize(): number {
  try {
    return fs.statSync(SERVER_LOG).size;
  } catch {
    return 0;
  }
}

export function readLogSince(offset: number): string {
  try {
    const buf = fs.readFileSync(SERVER_LOG);
    return buf.subarray(offset).toString("utf8");
  } catch {
    return "";
  }
}

/** All `[mail]` lines written after `offset`. */
export function mailLinesSince(offset: number): string[] {
  return readLogSince(offset)
    .split(/\r?\n/)
    .filter((l) => l.includes("[mail]"));
}

// Tokens are crypto-random-string "url-safe": A-Z a-z 0-9 - . _ ~
const RESET_LINK_RE = /https?:\/\/[^\s"'<>]+\/(?:student\/)?password\/reset\/[A-Za-z0-9._~\-]+/g;

/**
 * Extract reset links from `[mail]` log output written after `offset`.
 * A mail may be logged over several lines, so we scan the whole chunk from the
 * first `[mail]` marker onward, and prefer links that appear near `email`.
 */
export function resetLinksSince(offset: number, email?: string): string[] {
  const chunk = readLogSince(offset);
  const idx = chunk.indexOf("[mail]");
  if (idx < 0) return [];
  const mailPart = chunk.slice(idx);
  if (email) {
    // Split into per-mail blocks ("[mail] ---- ..." header lines) and keep the ones for the recipient.
    const blocks = mailPart.split(/\[mail\] -{3,} mail/).filter((b) => b.includes(email));
    const links = blocks.flatMap((b) => b.match(RESET_LINK_RE) || []);
    if (links.length) return links;
  }
  return mailPart.match(RESET_LINK_RE) || [];
}

export async function waitForResetLink(offset: number, email?: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const links = resetLinksSince(offset, email);
    if (links.length) return links[links.length - 1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `No reset link found in ${SERVER_LOG} for ${email ?? "<any>"} within ${timeoutMs}ms. ` +
      `Mail lines seen: ${JSON.stringify(mailLinesSince(offset)).slice(0, 500)}`
  );
}

// ---------------------------------------------------------------------------
// API helpers (black-box HTTP)
// ---------------------------------------------------------------------------

export interface Teacher {
  email: string;
  password: string;
  token: string; // "Bearer ..."
  fullname: string;
}

export async function apiSignupTeacher(
  request: APIRequestContext,
  opts: { feature_level?: "basic" | "advanced"; email?: string } = {}
): Promise<Teacher> {
  const email = opts.email || uniqueEmail("teacher");
  const fullname = uniqueName("Teacher");
  const res = await request.post("/api/auth/signup", {
    data: {
      email,
      password: PASSWORD,
      fullname,
      organization: "E2E Org",
      feature_level: opts.feature_level || "advanced",
      contact_for_research: "no",
      mode: "online",
    },
  });
  expect(res.status(), `signup ${email}: ${await res.text()}`).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  return { email, password: PASSWORD, token: body.jwt_token, fullname };
}

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  return request.post("/api/auth/signin", { data: { email, password } });
}

export function auth(t: { token: string }) {
  return { Authorization: t.token };
}

export async function apiCreateCourse(request: APIRequestContext, t: Teacher, name = uniqueName("Course")) {
  const res = await request.post("/api/courses/", { data: { name }, headers: auth(t) });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success, JSON.stringify(body)).toBe(true);
  return body.course as { _id: string; name: string };
}

export interface Lesson {
  _id: string;
  id: string; // public slug
  name: string;
  minutes: number;
  seconds: number;
}

/**
 * Adds a YouTube lesson. The server fetches the video's metadata from YouTube;
 * if that fails (no network / API key issue) the calling test is skipped with a
 * clear reason instead of faking data.
 */
export async function apiAddLesson(
  request: APIRequestContext,
  t: Teacher,
  courseId: string,
  name = uniqueName("Lesson")
): Promise<Lesson> {
  const res = await request.post(`/api/courses/${courseId}/lesson`, {
    data: { name, desc: "E2E lesson", youtube_link: YT_URL },
    headers: auth(t),
    timeout: 45_000,
  });
  const text = await res.text();
  if (res.status() === 400 && /youtube|video|duration/i.test(text)) {
    test.skip(true, `YouTube metadata fetch failed on the server (${res.status()}): ${text.slice(0, 200)}`);
  }
  expect(res.status(), text).toBe(200);
  const body = JSON.parse(text);
  expect(body.success, text).toBe(true);
  return body.lesson as Lesson;
}

export async function apiSignupStudent(request: APIRequestContext) {
  const email = uniqueEmail("student");
  const res = await request.post("/api/auth/student/signup", {
    data: { email, password: PASSWORD, confirm_password: PASSWORD, name: uniqueName("Student") },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  return { email, password: PASSWORD, token: body.jwt_token as string };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  // Logged in once the teacher nav appears. The app is expected to go to /dashboard;
  // tolerate landing elsewhere here (asserted explicitly in 02-teacher-auth.spec.ts).
  await expect(page.getByRole("banner").getByRole("link", { name: "Dashboard" })).toBeVisible();
  await page.waitForTimeout(300);
  if (!/\/dashboard$/.test(page.url())) await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Collects console errors / uncaught page errors for later assertions. */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Skip the first-visit dashboard tour modal if it shows up. */
export async function skipTourIfShown(page: Page) {
  const skip = page.getByRole("button", { name: "Skip tour" }).last();
  try {
    await skip.waitFor({ state: "visible", timeout: 5_000 });
    await skip.click();
  } catch {
    /* no tour */
  }
}
