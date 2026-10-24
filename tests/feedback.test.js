const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");

let app;
const Feedback = () => require("../database/models/feedback");
const GENERATED_DIR = path.resolve(__dirname, "../data/generated");
const listGenerated = () => (fs.existsSync(GENERATED_DIR) ? fs.readdirSync(GENERATED_DIR) : []);

beforeAll(async () => {
  app = await getApp();
});

describe("student feedback recording", () => {
  test("student records feedback on a lesson (by slug and by _id)", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const student = await F.signupStudent(app);

    const r1 = await F.recordFeedback(app, student, lesson.id, { timestamp: 30, feedback: "difficult", feedback_type: "too-fast" });
    expect(r1.status).toBe(200);
    expect(r1.body.success).toBe(true);

    const r2 = await F.recordFeedback(app, student, lesson._id, { timestamp: 90, feedback: "engaging", feedback_type: "other", other_message: "nice" });
    expect(r2.status).toBe(200);
    expect(r2.body.success).toBe(true);

    const docs = await Feedback().find({ lesson: lesson._id }).lean();
    expect(docs).toHaveLength(2);
    expect(docs.find((d) => d.seconds === 30).difficult).toBe(true);
    expect(docs.find((d) => d.seconds === 90).details.other).toBe("nice");
    expect(String(docs[0].student_id)).toBe(String(student.id));
  });

  test.each(["hacker", "constructor", "__proto__", "student_id", "lesson"])("unknown feedback type %p → 400 and nothing stored", async (type) => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const student = await F.signupStudent(app);
    const res = await F.recordFeedback(app, student, lesson._id, { feedback: type, feedback_type: undefined });
    expect(res.status).toBe(400);
    expect(await Feedback().countDocuments({ lesson: lesson._id })).toBe(0);
  });

  test("unauthenticated feedback is rejected", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app).post(`/api/lessons/${lesson._id}`).send({ timestamp: 10, feedback: "easy" });
    expect(res.status).toBe(401);
  });
});

describe("teacher reads feedback", () => {
  test("GET /api/lessons/:id/feedback aggregates student feedback", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const s1 = await F.signupStudent(app);
    const s2 = await F.signupStudent(app);
    await F.recordFeedback(app, s1, lesson._id, { timestamp: 30, feedback: "difficult", feedback_type: "too-fast" });
    await F.recordFeedback(app, s2, lesson._id, { timestamp: 70, feedback: "easy", feedback_type: "good-exp" });

    const res = await request(app).get(`/api/lessons/${lesson._id}/feedback?min=0&max=10`).set("Authorization", teacher.auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.feedback.students_count).toBe(2);
    expect(Array.isArray(res.body.feedback.class_feedback)).toBe(true);
    const totalDifficult = res.body.feedback.class_feedback.reduce((a, m) => a + m.difficult, 0);
    const totalEasy = res.body.feedback.class_feedback.reduce((a, m) => a + m.easy, 0);
    expect(totalDifficult).toBe(1);
    expect(totalEasy).toBe(1);
  });
});

describe("feedback export (xlsx, researcher-only)", () => {
  test("researcher gets a valid xlsx and no file is left in data/generated", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const student = await F.signupStudent(app);
    await F.recordFeedback(app, student, lesson._id);
    const researcher = await F.createResearcher(app);

    const before = new Set(listGenerated());
    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/feedback-export`)
      .set("Authorization", researcher.auth)
      .buffer(true)
      .parse(F.binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
    expect(res.body.slice(0, 2).toString("latin1")).toBe("PK");

    // Allow any async cleanup (e.g. unlink after sendFile) to finish.
    await new Promise((r) => setTimeout(r, 300));
    const leftovers = listGenerated().filter((f) => !before.has(f));
    expect(leftovers).toEqual([]);
  });

  test("export also works by lesson slug", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const researcher = await F.createResearcher(app);
    const res = await request(app).get(`/api/lessons/${lesson.id}/feedback-export`).set("Authorization", researcher.auth).buffer(true).parse(F.binaryParser);
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 2).toString("latin1")).toBe("PK");
  });

  test("export for a missing lesson → 404", async () => {
    const researcher = await F.createResearcher(app);
    const res = await request(app).get(`/api/lessons/ffffffffffffffffffffffff/feedback-export`).set("Authorization", researcher.auth);
    expect(res.status).toBe(404);
  });

  test("export with an invalid id → 400/404, not 500", async () => {
    const researcher = await F.createResearcher(app);
    const res = await request(app).get(`/api/lessons/%24where/feedback-export`).set("Authorization", researcher.auth);
    expect([400, 404]).toContain(res.status);
  });

  test("teacher (even the owner) and student tokens are rejected", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const student = await F.signupStudent(app);
    const t = await request(app).get(`/api/lessons/${lesson._id}/feedback-export`).set("Authorization", teacher.auth);
    expect([401, 403]).toContain(t.status);
    const s = await request(app).get(`/api/lessons/${lesson._id}/feedback-export`).set("Authorization", student.auth);
    expect([401, 403]).toContain(s.status);
  });

  test("export requires authentication", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app).get(`/api/lessons/${lesson._id}/feedback-export`);
    expect(res.status).toBe(401);
  });
});

describe("teacher feedback: not found", () => {
  test("feedback for a lesson that does not exist → 404", async () => {
    const teacher = await F.signupTeacher(app);
    const res = await request(app).get(`/api/lessons/ffffffffffffffffffffffff/feedback`).set("Authorization", teacher.auth);
    expect(res.status).toBe(404);
  });
});
