// Regression tests for the second review round (integration, against the real app + test DB).
const request = require("supertest");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");

let app;
beforeAll(async () => {
  app = await getApp();
});

const RefreshToken = () => require("../database/models/refresh-token");
const Lesson = () => require("../database/models/lesson");
const Feedback = () => require("../database/models/feedback");

const setCookieHeader = (res, name) => (res.headers["set-cookie"] || []).find((c) => c.startsWith(name + "="));

const readWorkbook = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
};

describe("#1 verifyResourceIsForUser: 404 for missing/not-owned, 401 only for auth", () => {
  test("another teacher's lesson feedback → 404", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const other = await F.signupTeacher(app);
    const res = await request(app).get(`/api/lessons/${lesson._id}/feedback`).set("Authorization", other.auth);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("missing lesson → 404 (by _id and by slug)", async () => {
    const t = await F.signupTeacher(app);
    expect((await request(app).get(`/api/lessons/ffffffffffffffffffffffff/feedback`).set("Authorization", t.auth)).status).toBe(404);
    expect((await request(app).get(`/api/lessons/no-such-slug-abc123/feedback`).set("Authorization", t.auth)).status).toBe(404);
  });

  test("malformed id → 400", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).get(`/api/lessons/${encodeURIComponent("a b")}/feedback`).set("Authorization", t.auth);
    expect(res.status).toBe(400);
  });

  test("no / invalid token → 401", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    expect((await request(app).get(`/api/lessons/${lesson._id}/feedback`)).status).toBe(401);
    expect((await request(app).get(`/api/lessons/${lesson._id}/feedback`).set("Authorization", "Bearer nope")).status).toBe(401);
  });

  test("owner still gets 200", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    expect((await request(app).get(`/api/lessons/${lesson._id}/feedback`).set("Authorization", teacher.auth)).status).toBe(200);
  });
});

describe("#2 sign-in does a bcrypt comparison even for unknown emails (no timing enumeration)", () => {
  const bcrypt = require("bcrypt");

  test.each([
    ["teacher", "/api/auth/signin"],
    ["student", "/api/auth/student/signin"],
    ["researcher", "/api/auth/researcher/signin"],
  ])("%s: unknown email runs async bcrypt.compare once, never compareSync", async (_n, url) => {
    const compare = jest.spyOn(bcrypt, "compare");
    const compareSync = jest.spyOn(bcrypt, "compareSync");
    try {
      const res = await request(app).post(url).send({ email: `nobody_${F.uniq()}@example.com`, password: "whatever-password" });
      expect([400, 401]).toContain(res.status);
      expect(res.body.jwt_token).toBeUndefined();
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compareSync).not.toHaveBeenCalled();
    } finally {
      compare.mockRestore();
      compareSync.mockRestore();
    }
  });

  test("known email + wrong password also uses async compare and fails; right password succeeds", async () => {
    const t = await F.signupTeacher(app);
    const compareSync = jest.spyOn(bcrypt, "compareSync");
    try {
      expect((await request(app).post("/api/auth/signin").send({ email: t.email, password: "wrong-password-1" })).status).toBe(401);
      expect((await request(app).post("/api/auth/signin").send({ email: t.email, password: t.password })).status).toBe(200);
      expect(compareSync).not.toHaveBeenCalled();
    } finally {
      compareSync.mockRestore();
    }
  });
});

describe("#3 xlsx sheet names: unique after truncation, non-ASCII kept", () => {
  const LONG = "Alexandria Konstantinopoulou Smith";
  const names = [LONG + " One", LONG + " Two", "Ярослава Иванова", "李小龍", "!!!"];

  test("researcher lesson logs export with colliding / non-ASCII names → 200 with one sheet per student", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const researcher = await F.createResearcher(app);
    for (const name of names) {
      const s = await F.signupStudent(app, { name });
      const r = await request(app).post(`/api/lessons/${lesson._id}/log`).set("Authorization", s.auth).send({ action: "play", duration: 3 });
      expect(r.body.success).toBe(true);
    }
    const res = await request(app)
      .get(`/api/researcher/lesson/${lesson._id}/logs`)
      .set("Authorization", researcher.auth)
      .buffer(true)
      .parse(F.binaryParser);
    expect(res.status).toBe(200);
    const wb = await readWorkbook(res.body);
    const sheetNames = wb.worksheets.map((w) => w.name);
    expect(sheetNames).toHaveLength(names.length);
    expect(new Set(sheetNames.map((n) => n.toUpperCase())).size).toBe(names.length);
    sheetNames.forEach((n) => {
      expect(n.length).toBeGreaterThan(0);
      expect(n.length).toBeLessThanOrEqual(31);
    });
    expect(sheetNames).toContain("ЯРОСЛАВА ИВАНОВА");
    expect(sheetNames).toContain("李小龍");
  });

  test("feedback export with colliding / non-ASCII names → 200", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const researcher = await F.createResearcher(app);
    for (const name of names) {
      const s = await F.signupStudent(app, { name });
      expect((await F.recordFeedback(app, s, lesson._id, { timestamp: 60 })).body.success).toBe(true);
    }
    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/feedback-export`)
      .set("Authorization", researcher.auth)
      .buffer(true)
      .parse(F.binaryParser);
    expect(res.status).toBe(200);
    const wb = await readWorkbook(res.body);
    const sheetNames = wb.worksheets.map((w) => w.name);
    expect(sheetNames).toEqual(expect.arrayContaining(["CLASS FEEDBACK", "NO FEEDBACK STUDENTS", "李小龍"]));
    expect(new Set(sheetNames.map((n) => n.toUpperCase())).size).toBe(sheetNames.length);
  });
});

describe("#5 over-deep input is rejected", () => {
  test("JSON body nested deeper than the limit → 400", async () => {
    let deep = { leaf: { $gt: "" } };
    for (let i = 0; i < 40; i++) deep = { a: deep };
    const res = await request(app).post("/api/auth/signin").send({ email: deep, password: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Invalid request body." });
  });

  test("moderately nested body is still accepted", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/signin").send({ email: t.email, password: t.password, extra: { a: { b: { c: 1 } } } });
    expect(res.status).toBe(200);
  });
});

describe("#6 signup password policy (8-32 chars)", () => {
  test.each([
    ["teacher", "/api/auth/signup", (pw) => F.teacherPayload({ password: pw })],
    ["student", "/api/auth/student/signup", (pw) => ({ email: `student_${F.uniq()}@example.com`, password: pw, name: "S" })],
  ])("%s: too short / too long → 400 with message; 8 and 32 chars OK", async (_n, url, body) => {
    for (const pw of ["short7!", "x".repeat(33)]) {
      const res = await request(app).post(url).send(body(pw));
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/8-32 characters/);
      expect(res.body.jwt_token).toBeUndefined();
    }
    for (const pw of ["x".repeat(8), "y".repeat(32)]) {
      const res = await request(app).post(url).send(body(pw));
      expect(res.status).toBe(200);
    }
  });

  test("duplicate signup keeps 401 and now includes a message", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/signup").send(F.teacherPayload({ email: t.email }));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: expect.stringMatching(/already exists/) });
  });
});

describe("#7 feedback timestamps", () => {
  let lesson, student;
  beforeAll(async () => {
    ({ lesson } = await F.seedTeacherWithLesson(app));
    student = await F.signupStudent(app);
  });

  const latestSeconds = async () => {
    const fb = await Feedback().findOne({ lesson: lesson._id }).sort({ createdAt: -1, _id: -1 });
    return fb.seconds;
  };

  test("missing timestamp is still recorded (without seconds)", async () => {
    const res = await F.recordFeedback(app, student, lesson._id, { timestamp: undefined });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await latestSeconds()).toBeUndefined();
  });

  test.each([["abc"], ["Infinity"], [true], [{ x: 1 }]])("non-finite timestamp %p → 400", async (timestamp) => {
    const res = await F.recordFeedback(app, student, lesson._id, { timestamp });
    expect(res.status).toBe(400);
  });

  test("timestamps are clamped to [0, lesson duration]", async () => {
    expect(lesson.seconds).toBe(600);
    await F.recordFeedback(app, student, lesson._id, { timestamp: 1e9 });
    expect(await latestSeconds()).toBe(600);
    await F.recordFeedback(app, student, lesson._id, { timestamp: -5 });
    expect(await latestSeconds()).toBe(0);
    await F.recordFeedback(app, student, lesson._id, { timestamp: "42.5" });
    expect(await latestSeconds()).toBe(42.5);
  });

  test("unknown duration → clamped to 24h", async () => {
    await Lesson().updateOne({ _id: lesson._id }, { $unset: { seconds: 1, minutes: 1 } });
    await F.recordFeedback(app, student, lesson._id, { timestamp: 1e9 });
    expect(await latestSeconds()).toBe(24 * 60 * 60);
  });
});

describe("#8 researcher refresh only accepts researcher tokens", () => {
  test("a refresh token stored under `user` (teacher or legacy) is rejected", async () => {
    const researcher = await F.createResearcher(app);
    const token = `legacy_${F.uniq()}`;
    await RefreshToken().create({ user: researcher.id, token, expire_at: new Date(Date.now() + 60000) });
    const res = await request(app).post("/api/auth/researcher/refresh").set("Cookie", `debe_researcher_token=${encodeURIComponent(token)}`);
    expect(res.body.success).toBe(false);
    expect(res.body.jwt_token).toBeUndefined();

    const teacher = await F.signupTeacher(app);
    const res2 = await request(app)
      .post("/api/auth/researcher/refresh")
      .set("Cookie", `debe_researcher_token=${encodeURIComponent(teacher.refreshCookie)}`);
    expect(res2.body.jwt_token).toBeUndefined();
  });

  test("a real researcher refresh token still works", async () => {
    const researcher = await F.createResearcher(app);
    const cookie = F.cookieValue(researcher.res, "debe_researcher_token");
    const res = await request(app).post("/api/auth/researcher/refresh").set("Cookie", `debe_researcher_token=${encodeURIComponent(cookie)}`);
    expect(res.body.success).toBe(true);
    expect(res.body.jwt_token).toMatch(/^Bearer /);
  });
});

describe("#9 malformed JSON body", () => {
  test("→ generic 400 without parser details", async () => {
    const res = await request(app).post("/api/auth/signin").set("Content-Type", "application/json").send('{"email": bad json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Invalid request body." });
    expect(JSON.stringify(res.body)).not.toMatch(/Unexpected token/);
  });
});

describe("#10 CSRF secret cookie is hardened", () => {
  test("_csrf cookie is HttpOnly and SameSite=Lax", async () => {
    const res = await request(app).get("/password/reset/some-token");
    const cookie = setCookieHeader(res, "_csrf");
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    // Not production in tests → no Secure flag (it is set when NODE_ENV=production)
    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  test("POST without a CSRF cookie/token, or with a token for another cookie, is rejected with 403", async () => {
    const path = "/password/reset/some-token";
    const form = { password: "New-Pass-word-123", confirm_password: "New-Pass-word-123" };

    const noCookie = await request(app).post(path).type("form").send({ ...form, _csrf: "x" });
    expect(noCookie.status).toBe(403);

    const agent = request.agent(app);
    await agent.get(path);
    const noToken = await agent.post(path).type("form").send(form);
    expect(noToken.status).toBe(403);

    // A valid pair from another browser: the token doesn't match this agent's secret cookie
    const other = request.agent(app);
    const page = await other.get("/password/reset/" + "x".repeat(10));
    const otherSecret = setCookieHeader(page, "_csrf").split(";")[0].split("=")[1];
    const { tokenFor } = require("../middleware/csrf");
    const wrongToken = await agent.post(path).type("form").send({ ...form, _csrf: tokenFor(decodeURIComponent(otherSecret)) });
    expect(wrongToken.status).toBe(403);
    expect(wrongToken.body).toEqual({ success: false, message: "invalid csrf token" });
  });
});

describe("#11 lesson slug index + migration", () => {
  const { migrateLessonSlugs } = require("../scripts/migrate-lesson-slugs");
  const quiet = () => {};

  test("several lessons without a slug (explicit null or missing) can coexist", async () => {
    await Lesson().init();
    await Lesson().collection.insertMany([{ name: "a", id: null }, { name: "b", id: null }, { name: "c" }]);
    await expect(Lesson().create({ name: "d", id: null })).resolves.toBeTruthy();
  });

  test("duplicate string slugs are still rejected by the index", async () => {
    await Lesson().init();
    const slug = `dup-${F.uniq()}`;
    await Lesson().create({ name: "x", id: slug });
    await expect(Lesson().create({ name: "y", id: slug })).rejects.toMatchObject({ code: 11000 });
  });

  test("dry run reports; --apply re-slugs null + duplicate ids (oldest keeps its slug) and restores the index", async () => {
    const coll = Lesson().collection;
    await coll.deleteMany({});
    await coll.dropIndex("id_1");
    // Old-style sparse index state with duplicates, as found in legacy databases
    const t0 = new Date("2021-01-01T00:00:00Z");
    const oldest = { name: "Shared", id: "shared-slug", createdAt: t0 };
    const newer = { name: "Shared copy", id: "shared-slug", createdAt: new Date(t0.getTime() + 1000) };
    const nullOne = { name: "No slug", id: null, createdAt: t0 };
    const missing = { name: "Missing", createdAt: t0 };
    const fine = { name: "Fine", id: "fine-slug", createdAt: t0 };
    await coll.insertMany([oldest, newer, nullOne, missing, fine]);
    await coll.createIndex({ id: 1 }, { name: "id_1", unique: true, sparse: true }).catch(() => null);

    const dry = await migrateLessonSlugs({ apply: false, log: quiet });
    expect(dry.missing).toHaveLength(2);
    expect(dry.duplicates).toEqual([expect.objectContaining({ id: "shared-slug" })]);
    expect(dry.changes).toEqual([]);
    expect(await coll.countDocuments({ id: "shared-slug" })).toBe(2); // unchanged

    const lines = [];
    const applied = await migrateLessonSlugs({ apply: true, log: (l) => lines.push(l) });
    expect(applied.changes).toHaveLength(3);
    expect(lines.join("\n")).toMatch(/"shared-slug" -> "shared-copy-[A-Za-z0-9]{6}"/);

    expect((await coll.findOne({ _id: oldest._id })).id).toBe("shared-slug");
    expect((await coll.findOne({ _id: fine._id })).id).toBe("fine-slug");
    const reslugged = await coll.find({ _id: { $in: [newer._id, nullOne._id, missing._id] } }).toArray();
    reslugged.forEach((l) => expect(typeof l.id).toBe("string"));
    expect(new Set(reslugged.map((l) => l.id)).size).toBe(3);

    const index = (await coll.indexes()).find((i) => i.name === "id_1");
    expect(index.unique).toBe(true);
    expect(index.sparse).toBeUndefined();
    expect(index.partialFilterExpression).toEqual({ id: { $type: "string" } });

    const again = await migrateLessonSlugs({ apply: true, log: quiet });
    expect(again.missing).toHaveLength(0);
    expect(again.duplicates).toHaveLength(0);
    expect(again.changes).toHaveLength(0);
    expect(again.index).toBe("ok");
    await coll.deleteMany({});
  });

  test("startup index check logs failed unique index builds loudly without throwing", async () => {
    const { db } = require("../database");
    const collName = `dup_index_probe_${F.uniq()}`;
    await mongoose.connection.db.collection(collName).insertMany([{ k: 1 }, { k: 1 }]);
    const schema = new mongoose.Schema({ k: { type: Number, unique: true } }, { collection: collName });
    const modelName = `DupIndexProbe_${F.uniq()}`;
    mongoose.model(modelName, schema);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failures = await db.ensureIndexes();
      expect(failures.map((f) => f.model)).toContain(modelName);
      expect(errorSpy.mock.calls.map((c) => c.join(" ")).join("\n")).toMatch(new RegExp(`INDEX BUILD FAILED for model "${modelName}"`));
    } finally {
      errorSpy.mockRestore();
      mongoose.deleteModel(modelName);
      await mongoose.connection.db.collection(collName).drop().catch(() => null);
    }
  });
});

describe("#13 validation errors → 400", () => {
  test("saveLessonAnalysis with a too-long topic → 400 with a message", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/analysis`)
      .set("Authorization", teacher.auth)
      .send({ duration: [1, 2], feedback_selected: "easy", topic: "t".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/topic is too long/);
    expect(res.body.message).not.toMatch(/tttt/);
  });

  test("lesson edit with a too-long name → 400 with a message", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .put(`/api/lessons/${lesson._id}`)
      .set("Authorization", teacher.auth)
      .send({ name: "n".repeat(200), desc: "d", youtube_link: lesson.youtube_link });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name is too long/);
  });
});

describe("#15 export errors before the body is sent", () => {
  const XLSX = require("exceljs/lib/xlsx/xlsx");

  test.each([
    ["feedback export", (lesson) => `/api/lessons/${lesson._id}/feedback-export`],
    ["researcher logs export", (lesson) => `/api/researcher/lesson/${lesson._id}/logs`],
  ])("%s: JSON 500 without attachment headers", async (_n, url) => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const researcher = await F.createResearcher(app);
    const write = jest.spyOn(XLSX.prototype, "write").mockRejectedValue(new Error("boom"));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const res = await request(app).get(url(lesson)).set("Authorization", researcher.auth);
      expect(res.status).toBe(500);
      expect(res.headers["content-disposition"]).toBeUndefined();
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body).toEqual({ success: false, message: "Internal server error" });
    } finally {
      write.mockRestore();
      logSpy.mockRestore();
    }
  });

  test("error after streaming started → connection is aborted (no truncated 200 file)", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const researcher = await F.createResearcher(app);
    const write = jest.spyOn(XLSX.prototype, "write").mockImplementation(async (stream) => {
      stream.write(Buffer.from("PK partial"));
      await new Promise((r) => setTimeout(r, 20));
      throw new Error("boom mid-stream");
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(
        request(app).get(`/api/lessons/${lesson._id}/feedback-export`).set("Authorization", researcher.auth).buffer(true).parse(F.binaryParser)
      ).rejects.toThrow();
    } finally {
      write.mockRestore();
      logSpy.mockRestore();
    }
  });
});

describe("#16 logout works without a valid access token", () => {
  test("teacher: no Authorization header → 200, refresh token deleted, cookie cleared", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/logout").set("Cookie", `debe_token=${encodeURIComponent(t.refreshCookie)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const cleared = setCookieHeader(res, "debe_token");
    expect(cleared).toMatch(/^debe_token=;/);
    expect(cleared).toMatch(/HttpOnly/i);
    expect(cleared).toMatch(/SameSite=Lax/i);
    expect(await RefreshToken().countDocuments({ token: t.refreshCookie })).toBe(0);
    const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", `debe_token=${encodeURIComponent(t.refreshCookie)}`);
    expect(refreshed.body.jwt_token).toBeUndefined();
  });

  test("student and researcher: expired/garbage bearer is ignored, token deleted", async () => {
    const s = await F.signupStudent(app);
    const r1 = await request(app)
      .post("/api/auth/student/logout")
      .set("Authorization", "Bearer expired.garbage.token")
      .set("Cookie", `debe_student_token=${encodeURIComponent(s.refreshCookie)}`);
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ success: true });
    expect(await RefreshToken().countDocuments({ token: s.refreshCookie })).toBe(0);

    const researcher = await F.createResearcher(app);
    const rc = F.cookieValue(researcher.res, "debe_researcher_token");
    const r2 = await request(app).post("/api/auth/researcher/logout").set("Cookie", `debe_researcher_token=${encodeURIComponent(rc)}`);
    expect(r2.status).toBe(200);
    expect(await RefreshToken().countDocuments({ token: rc })).toBe(0);
  });

  test("scoped to the owner type: a teacher token sent to student logout is not deleted", async () => {
    const t = await F.signupTeacher(app);
    const res = await request(app).post("/api/auth/student/logout").set("Cookie", `debe_student_token=${encodeURIComponent(t.refreshCookie)}`);
    expect(res.status).toBe(200);
    expect(await RefreshToken().countDocuments({ token: t.refreshCookie })).toBe(1);
  });

  test("no cookie at all → still 200", async () => {
    for (const url of ["/api/auth/logout", "/api/auth/student/logout", "/api/auth/researcher/logout"]) {
      const res = await request(app).post(url);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    }
  });
});

describe("#17 renaming a lesson keeps its slug", () => {
  test("PUT /api/lessons/:id with a new name → same slug, student link still works", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .put(`/api/lessons/${lesson._id}`)
      .set("Authorization", teacher.auth)
      .send({ name: "A completely new name", desc: "d", youtube_link: lesson.youtube_link });
    expect(res.status).toBe(200);
    expect(res.body.lesson.name).toBe("A completely new name");
    expect(res.body.lesson.id).toBe(lesson.id);
    const pub = await request(app).get(`/api/lessons/${lesson.id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.lesson.name).toBe("A completely new name");
  });
});

describe("#18 per-run test database", () => {
  test("DB name is unique per jest run", () => {
    expect(process.env.DB_URI).toMatch(/\/tcherly_test_jest_\d+$/);
    expect(mongoose.connection.name).toMatch(/^tcherly_test_jest_\d+$/);
  });
});

describe("reset-password pages accept any 8-32 character password (client check matches server)", () => {
  const vm = require("vm");
  const { submitReset } = require("./helpers/reset");
  const Token = () => require("../database/models/token");

  const makeResetToken = async (field, ownerId) => {
    const token = `reset${F.uniq()}${"x".repeat(60)}`;
    await Token().create({ token, [field]: ownerId });
    return token;
  };

  /** Pulls the page's client-side password check out of the rendered HTML and evaluates it. */
  const clientCheck = (html) => {
    const m = html.match(/const isValidPassword = ([^\n]+);/);
    expect(m).not.toBeNull();
    expect(html).not.toMatch(/const regex = \//);
    return vm.runInNewContext(`(${m[1]})`);
  };

  test.each([
    ["teacher", "", "user", F.signupTeacher, "/api/auth/signin"],
    ["student", "/student", "student", F.signupStudent, "/api/auth/student/signin"],
  ])("%s: 'New-Pass-word-123' passes the page check and the server reset; 7/33 chars are rejected", async (_n, prefix, field, signup, signinUrl) => {
    const account = await signup(app);
    const token = await makeResetToken(field, account.id);

    const page = await request(app).get(`${prefix}/password/reset/${token}`);
    expect(page.status).toBe(200);
    const isValid = clientCheck(page.text);
    expect(isValid("New-Pass-word-123")).toBe(true);
    expect(isValid("a~{|}:-+b")).toBe(true);
    expect(isValid("x".repeat(7))).toBe(false);
    expect(isValid("x".repeat(33))).toBe(false);

    // Server enforces the same 8-32 rule (rejections don't consume the token)
    for (const bad of ["x".repeat(7), "x".repeat(33)]) {
      const { res } = await submitReset(app, token, bad, prefix);
      expect(res.text).toMatch(/between 8-32 characters/);
    }

    const { res } = await submitReset(app, token, "New-Pass-word-123", prefix);
    expect(res.status).toBe(302);
    expect((await request(app).post(signinUrl).send({ email: account.email, password: "New-Pass-word-123" })).status).toBe(200);
  });
});
