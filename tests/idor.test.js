const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");

let app, A, B;
const Lesson = () => require("../database/models/lesson");
const Bookmark = () => require("../database/models/bookmark");
const Course = () => require("../database/models/course");

// 400 is acceptable as long as nothing was read/mutated (asserted separately).
const DENIED = [400, 401, 403, 404];

beforeAll(async () => {
  app = await getApp();
  A = await F.seedTeacherWithLesson(app); // { teacher, course, lesson, bookmark }
  B = { teacher: await F.signupTeacher(app) };
  B.course = await F.createCourse(app, B.teacher);
});

const asB = (req) => req.set("Authorization", B.teacher.auth);
const asA = (req) => req.set("Authorization", A.teacher.auth);

describe("lesson IDOR: teacher B vs teacher A's lesson", () => {
  // Fresh bookmark per test so one leaking test does not cascade into others.
  beforeEach(async () => {
    A.bookmark = await F.addBookmark(app, A.teacher, A.lesson._id);
  });

  test("B cannot read A's lesson feedback analytics", async () => {
    const res = await asB(request(app).get(`/api/lessons/${A.lesson._id}/feedback`));
    expect(DENIED).toContain(res.status);
    expect(res.body && res.body.lesson).toBeFalsy();
  });

  test("B cannot export A's lesson feedback", async () => {
    const res = await asB(request(app).get(`/api/lessons/${A.lesson._id}/feedback-export`));
    expect(DENIED).toContain(res.status);
  });

  test("B cannot edit A's lesson", async () => {
    const res = await asB(request(app).put(`/api/lessons/${A.lesson._id}`)).send({
      name: "Hijacked",
      desc: "pwned",
      youtube_link: A.lesson.youtube_link,
    });
    expect(DENIED).toContain(res.status);
    const l = await Lesson().findById(A.lesson._id);
    expect(l.name).toBe(A.lesson.name);
  });

  test("B cannot save analysis on A's lesson", async () => {
    const res = await asB(request(app).post(`/api/lessons/${A.lesson._id}/analysis`)).send({ duration: 1, feedback_selected: ["easy"], topic: "x" });
    expect(DENIED).toContain(res.status);
    const l = await Lesson().findById(A.lesson._id).lean();
    expect(l.analysis || []).toHaveLength(0);
  });

  test("B cannot add a bookmark to A's lesson", async () => {
    const before = (await Lesson().findById(A.lesson._id)).bookmarks.length;
    const res = await asB(request(app).put(`/api/lessons/${A.lesson._id}/bookmark/add`)).send(F.bookmarkPayload({ topic: "B's" }));
    expect(DENIED).toContain(res.status);
    const l = await Lesson().findById(A.lesson._id);
    expect(l.bookmarks.length).toBe(before);
    expect(await Bookmark().countDocuments({ topic: "B's" })).toBe(0);
  });

  test("B cannot switch A's current bookmark (even to B's own bookmark)", async () => {
    const bLesson = await F.addLesson(app, B.teacher, B.course._id);
    const bBookmark = await F.addBookmark(app, B.teacher, bLesson._id);
    const res = await asB(request(app).put(`/api/lessons/${A.lesson._id}/bookmark/switch`)).send({ switch_to: bBookmark._id });
    expect(DENIED).toContain(res.status);
    const l = await Lesson().findById(A.lesson._id);
    expect(String(l.current_bookmark)).toBe(String(A.bookmark._id));
  });

  test("B cannot delete A's bookmark", async () => {
    const res = await asB(request(app).put(`/api/lessons/${A.lesson._id}/bookmark/delete`)).send({
      delete: A.bookmark._id,
      switch_to: A.bookmark._id,
    });
    expect(DENIED).toContain(res.status);
    expect(await Bookmark().findById(A.bookmark._id)).not.toBeNull();
  });

  test("B cannot delete A's bookmark via B's own lesson id", async () => {
    const bLesson = await F.addLesson(app, B.teacher, B.course._id);
    const bBookmark = await F.addBookmark(app, B.teacher, bLesson._id);
    const res = await asB(request(app).put(`/api/lessons/${bLesson._id}/bookmark/delete`)).send({
      delete: A.bookmark._id,
      switch_to: bBookmark._id,
    });
    expect(res.status).toBeLessThan(500);
    expect(await Bookmark().findById(A.bookmark._id)).not.toBeNull();
  });

  test.each([
    ["save", (id) => `/api/lessons/bookmark/save/${id}`, { topic: "B edited" }],
    ["add-question", (id) => `/api/lessons/bookmark/${id}/add-question`, { question: { name: "B question", action: "B" } }],
    ["edit-questions", (id) => `/api/lessons/bookmark/${id}/edit-questions`, { questions: [] }],
    ["add-action", (id) => `/api/lessons/bookmark/${id}/add-action`, { action: { question: 0, action: "B action", future_action: "B" } }],
    ["edit-actions", (id) => `/api/lessons/bookmark/${id}/edit-actions`, { actions: [] }],
  ])("B cannot edit A's bookmark via %s", async (_name, url, body) => {
    const before = await Bookmark().findById(A.bookmark._id).lean();
    const res = await asB(request(app).put(url(A.bookmark._id))).send(body);
    expect(DENIED).toContain(res.status);
    const after = await Bookmark().findById(A.bookmark._id).lean();
    expect(after.topic).toBe(before.topic);
    expect(after.questions.length).toBe(before.questions.length);
    expect(after.actions.length).toBe(before.actions.length);
  });

  test("A can still read feedback, edit and add bookmarks on own lesson", async () => {
    const fb = await asA(request(app).get(`/api/lessons/${A.lesson._id}/feedback`));
    expect(fb.status).toBe(200);
    expect(fb.body.success).toBe(true);

    const edit = await asA(request(app).put(`/api/lessons/${A.lesson._id}`)).send({
      name: A.lesson.name,
      desc: "Updated by owner",
      youtube_link: A.lesson.youtube_link,
    });
    expect(edit.status).toBe(200);
    expect(edit.body.success).toBe(true);

    const save = await asA(request(app).put(`/api/lessons/bookmark/save/${A.bookmark._id}`)).send({ topic: "Owner topic" });
    expect(save.status).toBe(200);
    expect(save.body.bookmark.topic).toBe("Owner topic");
  });
  test("B cannot delete A's lesson", async () => {
    const res = await asB(request(app).delete(`/api/lessons/${A.lesson._id}`));
    expect(DENIED).toContain(res.status);
    expect(await Lesson().findById(A.lesson._id)).not.toBeNull();
  });

});

describe("course routes are scoped per user", () => {
  test("B's course list does not include A's course", async () => {
    const res = await asB(request(app).get("/api/courses"));
    expect(res.status).toBe(200);
    const ids = res.body.courses.map((c) => String(c._id));
    expect(ids).toContain(String(B.course._id));
    expect(ids).not.toContain(String(A.course._id));
  });

  test("B cannot read A's course", async () => {
    const res = await asB(request(app).get(`/api/courses/${A.course._id}`));
    expect(res.status).toBeLessThan(500);
    expect(res.body.course).toBeFalsy();
  });

  test("B cannot rename A's course", async () => {
    const res = await asB(request(app).put(`/api/courses/${A.course._id}`)).send({ name: "Hijacked" });
    expect(res.status).toBeLessThan(500);
    expect((await Course().findById(A.course._id)).name).toBe(A.course.name);
  });

  test("B cannot add a lesson to A's course", async () => {
    const res = await asB(request(app).post(`/api/courses/${A.course._id}/lesson`)).send({
      name: "Injected",
      youtube_link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(DENIED).toContain(res.status);
    expect(await Lesson().countDocuments({ name: "Injected" })).toBe(0);
  });

  test("B cannot delete A's course", async () => {
    const res = await asB(request(app).delete(`/api/courses/${A.course._id}`));
    expect(res.status).toBeLessThan(500);
    expect(await Course().findById(A.course._id)).not.toBeNull();
  });

  test("A can read own course with its lessons", async () => {
    const res = await asA(request(app).get(`/api/courses/${A.course._id}`));
    expect(res.status).toBe(200);
    expect(res.body.course.lessons.map((l) => String(l._id))).toContain(String(A.lesson._id));
  });

  test("unauthenticated course list is rejected", async () => {
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(401);
  });
});
