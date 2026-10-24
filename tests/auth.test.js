const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");
const { sentMails, extractResetLink, getSendMail } = require("./helpers/mail");
const { submitReset } = require("./helpers/reset");

let app;
beforeAll(async () => {
  app = await getApp();
});

describe("teacher auth happy path", () => {
  test("signup returns a bearer JWT and sets refresh cookie", async () => {
    const t = await F.signupTeacher(app);
    expect(t.token).toMatch(/^Bearer /);
    expect(t.refreshCookie).toBeTruthy();
    expect(t.res.body.user).toBeDefined();
    expect(t.res.body.user.password).toBeUndefined();
  });

  test("duplicate signup is rejected", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/signup").send(F.teacherPayload({ email: t.email }));
    expect([400, 401, 409]).toContain(res.status);
    expect(res.body.jwt_token).toBeUndefined();
  });

  test("signin with correct password succeeds, wrong password fails", async () => {
    const t = await F.signupTeacher(app);
    const ok = await request(app).post("/api/auth/signin").send({ email: t.email, password: t.password });
    expect(ok.status).toBe(200);
    expect(ok.body.jwt_token).toMatch(/^Bearer /);

    const bad = await request(app).post("/api/auth/signin").send({ email: t.email, password: "wrong-password-123" });
    expect([400, 401]).toContain(bad.status);
    expect(bad.body.jwt_token).toBeUndefined();
  });

  test("refresh with cookie issues a new access token", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/refresh").set("Cookie", `debe_token=${encodeURIComponent(t.refreshCookie)}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.jwt_token).toMatch(/^Bearer /);
  });

  test("refresh without cookie does not issue a token (regression: findOne({token: undefined}) matched any session)", async () => {
    // Make sure refresh tokens of both account types exist in the DB.
    await F.signupTeacher(app);
    await F.signupStudent(app);
    for (const url of ["/api/auth/refresh", "/api/auth/student/refresh", "/api/auth/researcher/refresh"]) {
      const res = await request(app).post(url);
      expect(res.status).toBeLessThan(500);
      expect(res.body.success).not.toBe(true);
      expect(res.body.jwt_token).toBeUndefined();
      expect(res.body.user).toBeUndefined();
    }
  });

  test("empty refresh cookie does not issue a token", async () => {
    await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/refresh").set("Cookie", "debe_token=");
    expect(res.body.jwt_token).toBeUndefined();
  });

  test("a student refresh token cannot be used on the teacher refresh endpoint (and vice versa)", async () => {
    const s = await F.signupStudent(app);
    const t = await F.signupTeacher(app);
    expect(s.refreshCookie).toBeTruthy();

    const r1 = await request(app).post("/api/auth/refresh").set("Cookie", `debe_token=${encodeURIComponent(s.refreshCookie)}`);
    expect(r1.status).toBeLessThan(500);
    expect(r1.body.jwt_token).toBeUndefined();

    const r2 = await request(app).post("/api/auth/student/refresh").set("Cookie", `debe_student_token=${encodeURIComponent(t.refreshCookie)}`);
    expect(r2.status).toBeLessThan(500);
    expect(r2.body.jwt_token).toBeUndefined();

    const r3 = await request(app).post("/api/auth/researcher/refresh").set("Cookie", `debe_researcher_token=${encodeURIComponent(t.refreshCookie)}`);
    expect(r3.status).toBeLessThan(500);
    expect(r3.body.jwt_token).toBeUndefined();
  });

  test.each([
    ["basic", "basic"],
    ["advanced", "advanced"],
    ["advanced-research", "basic"],
    [undefined, "basic"],
  ])("signup feature_level %p is stored as %p", async (input, expected) => {
    const User = require("../database/models/user");
    const t = await F.signupTeacher(app, { feature_level: input });
    const u = await User.findOne({ email: t.email });
    expect(u.feature_level).toBe(expected);
  });
});

describe("student auth happy path", () => {
  test("student signup + signin + refresh", async () => {
    const s = await F.signupStudent(app);
    expect(s.token).toMatch(/^Bearer /);

    const res = await request(app).post("/api/auth/student/signin").send({ email: s.email, password: s.password });
    expect(res.status).toBe(200);
    expect(res.body.jwt_token).toMatch(/^Bearer /);

    const cookie = F.cookieValue(res, "debe_student_token");
    const r = await request(app).post("/api/auth/student/refresh").set("Cookie", `debe_student_token=${encodeURIComponent(cookie)}`);
    expect(r.status).toBe(200);
    expect(r.body.jwt_token).toMatch(/^Bearer /);
  });
});

describe("JWT claims", () => {
  test("teacher access token lifetime is ~1 hour (seconds, not ms)", async () => {
    const t = await F.signupTeacher(app);
    const p = F.decodeToken(t.token);
    expect(p.exp - p.iat).toBeGreaterThanOrEqual(3500);
    expect(p.exp - p.iat).toBeLessThanOrEqual(3700);
  });

  test("student access token lifetime is ~1 hour", async () => {
    const s = await F.signupStudent(app);
    const p = F.decodeToken(s.token);
    expect(p.exp - p.iat).toBeGreaterThanOrEqual(3500);
    expect(p.exp - p.iat).toBeLessThanOrEqual(3700);
  });

  test("student token cannot access teacher endpoints", async () => {
    const s = await F.signupStudent(app);
    const res = await request(app).get("/api/courses").set("Authorization", s.auth);
    expect([401, 403]).toContain(res.status);
  });

  test("student token is rejected by teacher endpoints even if a teacher shares its _id (type claim)", async () => {
    const User = require("../database/models/user");
    const s = await F.signupStudent(app);
    await User.create({ _id: s.id, email: `shadow_${F.uniq()}@example.com`, feature_level: "basic", password: "x" });
    const res = await request(app).get("/api/courses").set("Authorization", s.auth);
    expect([401, 403]).toContain(res.status);
  });

  test("teacher token cannot record student feedback", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await F.recordFeedback(app, teacher, lesson._id);
    expect([401, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Password reset (teacher: /api/auth/password/forgot + /password/reset/:token,
// student: /api/auth/student/password/forgot + /student/password/reset/:token)
// ---------------------------------------------------------------------------
const flows = [
  {
    kind: "teacher",
    prefix: "",
    signup: F.signupTeacher,
    signinUrl: "/api/auth/signin",
    forgotUrl: "/api/auth/password/forgot",
    Model: () => require("../database/models/user"),
    tokenField: "user",
  },
  {
    kind: "student",
    prefix: "/student",
    signup: F.signupStudent,
    signinUrl: "/api/auth/student/signin",
    forgotUrl: "/api/auth/student/password/forgot",
    Model: () => require("../database/models/student"),
    tokenField: "student",
  },
];

describe.each(flows)("$kind password reset", ({ kind, prefix, signup, signinUrl, forgotUrl, Model, tokenField }) => {
  const signin = (email, password) => request(app).post(signinUrl).send({ email, password });
  const linkRe = kind === "student" ? "/student" : "";

  test("reset link uses APP_URL, not the request Host header", async () => {
    const u = await signup(app);
    const res = await request(app).post(forgotUrl).set("Host", "evil.com").send({ email: u.email });
    expect(res.status).toBe(200);
    const mails = sentMails();
    expect(mails).toHaveLength(1);
    const body = JSON.stringify(mails[0]);
    expect(body).not.toContain("evil.com");
    const link = extractResetLink(mails[0], linkRe);
    expect(link).not.toBeNull();
    expect(link.url.startsWith(`http://tcherly.test${prefix}/password/reset/`)).toBe(true);
  });

  test("valid token resets the password exactly once (single use)", async () => {
    const u = await signup(app);
    await request(app).post(forgotUrl).send({ email: u.email });
    const link = extractResetLink(sentMails()[0], linkRe);
    expect(link).not.toBeNull();

    const newPass = "BrandNewPass#1";
    const first = await submitReset(app, link.token, newPass, prefix);
    expect(first.res.status).toBeLessThan(500);
    expect((await signin(u.email, newPass)).status).toBe(200);
    expect((await signin(u.email, u.password)).status).not.toBe(200);

    const again = "AnotherPass#22";
    const second = await submitReset(app, link.token, again, prefix);
    expect(second.res.status).toBeLessThan(500);
    expect((await signin(u.email, again)).status).not.toBe(200);
    expect((await signin(u.email, newPass)).status).toBe(200);
  });

  test("expired token is rejected", async () => {
    const Token = require("../database/models/token");
    const u = await signup(app);
    const doc = await Model().findOne({ email: u.email });
    const token = `expired${F.uniq()}${"x".repeat(60)}`;
    await Token.create({ token, [tokenField]: doc._id, expires_at: new Date(Date.now() - 60 * 1000) });

    const newPass = "ExpiredPass#123";
    const { res } = await submitReset(app, token, newPass, prefix);
    expect(res.status).toBeLessThan(500);
    expect((await signin(u.email, newPass)).status).not.toBe(200);
    expect((await signin(u.email, u.password)).status).toBe(200);
  });

  test("forgot-password cooldown: a second request right away sends no second mail", async () => {
    const u = await signup(app);
    await request(app).post(forgotUrl).send({ email: u.email });
    const r2 = await request(app).post(forgotUrl).send({ email: u.email });
    expect(r2.status).toBeLessThan(500);
    expect(getSendMail()).toHaveBeenCalledTimes(1);
  });

  test("unknown email: generic response, no mail", async () => {
    const res = await request(app).post(forgotUrl).send({ email: `nobody_${F.uniq()}@example.com` });
    expect(res.status).toBe(200);
    expect(getSendMail()).not.toHaveBeenCalled();
  });

  test("operator injection in email ({$ne:null}) sends no mail and does not 500", async () => {
    await signup(app);
    const res = await request(app).post(forgotUrl).send({ email: { $ne: null } });
    expect(res.status).toBeLessThan(500);
    expect(getSendMail()).not.toHaveBeenCalled();
  });
});
