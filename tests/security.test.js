const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");

let app;
beforeAll(async () => {
  app = await getApp();
  // Make sure at least one account of each type exists so `$gt: ""` would match something.
  await F.signupTeacher(app);
  await F.signupStudent(app);
});

describe("CORS", () => {
  const preflight = (origin) =>
    request(app)
      .options("/api/courses")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,content-type");

  test("preflight from an untrusted origin gets no Access-Control-Allow-Origin", async () => {
    const res = await preflight("https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("simple request from an untrusted origin gets no Access-Control-Allow-Origin", async () => {
    const res = await request(app).get("/api/misc/columns").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("preflight from the dev client origin is allowed (non-production)", async () => {
    const res = await preflight("http://localhost:8080");
    expect(res.status).toBeLessThan(300);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:8080");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("NoSQL operator injection", () => {
  test.each([
    ["teacher signin", "/api/auth/signin"],
    ["student signin", "/api/auth/student/signin"],
    ["researcher signin", "/api/auth/researcher/signin"],
  ])("%s with {$gt:''} credentials never succeeds or 500s", async (_n, url) => {
    const res = await request(app).post(url).send({ email: { $gt: "" }, password: { $gt: "" } });
    expect([400, 401]).toContain(res.status);
    expect(res.body && res.body.jwt_token).toBeFalsy();
  });

  test("signin with {$ne:null} email and a real password does not log in", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/signin").send({ email: { $ne: null }, password: t.password });
    expect([400, 401]).toContain(res.status);
    expect(res.body && res.body.jwt_token).toBeFalsy();
  });

  test("$-prefixed keys are stripped from request bodies (course update with $set is ignored)", async () => {
    const t = await F.signupTeacher(app);
    const course = await F.createCourse(app, t, "Original");
    const res = await request(app)
      .put(`/api/courses/${course._id}`)
      .set("Authorization", t.auth)
      .send({ name: "Renamed", $set: { user: "ffffffffffffffffffffffff" } });
    expect(res.status).toBeLessThan(500);
    const Course = require("../database/models/course");
    const c = await Course.findById(course._id);
    expect(String(c.user)).toBe(String(t.id));
  });

  test("nested $ operators inside bookmark payloads are stripped / rejected, never 500", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .put(`/api/lessons/${lesson._id}/bookmark/switch`)
      .set("Authorization", teacher.auth)
      .send({ switch_to: { $ne: null } });
    expect(res.status).toBeLessThan(500);
    expect([400, 404]).toContain(res.status);
  });
});

describe("error responses", () => {
  test("unknown /api route → 404 JSON", async () => {
    const res = await request(app).get("/api/this/does/not/exist");
    expect(res.status).toBe(404);
  });

  test("malformed JSON body → 4xx, not 500", async () => {
    const res = await request(app).post("/api/auth/signin").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
