const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");
const { FAKE_SECONDS } = require("./helpers/youtube-mock");

let app;
const Lesson = () => require("../database/models/lesson");
const Bookmark = () => require("../database/models/bookmark");
const Course = () => require("../database/models/course");
const Feedback = () => require("../database/models/feedback");

beforeAll(async () => {
  app = await getApp();
});

describe("course + lesson happy path", () => {
  test("create course, add lesson (YouTube mocked), lesson linked to course", async () => {
    const t = await F.signupTeacher(app);
    const course = await F.createCourse(app, t, "Physics 101");
    expect(course.name).toBe("Physics 101");

    const lesson = await F.addLesson(app, t, course._id, { name: "Newton laws" });
    expect(lesson.seconds).toBe(FAKE_SECONDS);
    expect(lesson.minutes).toBe(Math.ceil(FAKE_SECONDS / 60));
    expect(String(lesson.course)).toBe(String(course._id));
    expect(String(lesson.user)).toBe(String(t.id));
    expect(lesson.id).toMatch(/^newton-laws-/);

    const c = await Course().findById(course._id);
    expect(c.lessons.map(String)).toContain(String(lesson._id));
    expect(require("../utils/youtube").getVideoDuration).toHaveBeenCalled();
  });

  test("add lesson with missing fields is rejected", async () => {
    const t = await F.signupTeacher(app);
    const course = await F.createCourse(app, t);
    const res = await request(app).post(`/api/courses/${course._id}/lesson`).set("Authorization", t.auth).send({ name: "x" });
    expect(res.status).toBeLessThan(500);
    expect(res.body.success).toBe(false);
  });

  test("YouTube failure while adding lesson returns 4xx, not 500", async () => {
    const yt = require("../utils/youtube");
    yt.getVideoDuration.mockRejectedValueOnce(new Error("Video not found"));
    if (yt.getVideo) yt.getVideo.mockRejectedValueOnce(new Error("Video not found"));
    const t = await F.signupTeacher(app);
    const course = await F.createCourse(app, t);
    const res = await request(app)
      .post(`/api/courses/${course._id}/lesson`)
      .set("Authorization", t.auth)
      .send({ name: "Bad video", youtube_link: "https://www.youtube.com/watch?v=xxxxxxxxxxx" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("bookmarks happy path", () => {
  test("add bookmark, add question, add action, switch", async () => {
    const { teacher, lesson, bookmark } = await F.seedTeacherWithLesson(app);
    expect(bookmark.topic).toBe("Intro topic");

    const q = await request(app)
      .put(`/api/lessons/bookmark/${bookmark._id}/add-question`)
      .set("Authorization", teacher.auth)
      .send({ question: { name: "Why?", action: "Explain again" } });
    expect(q.status).toBe(200);
    expect(q.body.bookmark.questions.map((x) => x.name)).toContain("Why?");

    const a = await request(app)
      .put(`/api/lessons/bookmark/${bookmark._id}/add-action`)
      .set("Authorization", teacher.auth)
      .send({ action: { question: 1, action: "Did it", future_action: "Do more" } });
    expect(a.status).toBe(200);
    expect(a.body.bookmark.actions.map((x) => x.action)).toContain("Did it");

    const second = await F.addBookmark(app, teacher, lesson._id, { topic: "Second" });
    const sw = await request(app)
      .put(`/api/lessons/${lesson._id}/bookmark/switch`)
      .set("Authorization", teacher.auth)
      .send({ switch_to: bookmark._id });
    expect(sw.status).toBe(200);
    expect(String(sw.body.current_bookmark._id)).toBe(String(bookmark._id));
    expect(String((await Lesson().findById(lesson._id)).current_bookmark)).toBe(String(bookmark._id));
    expect(second.topic).toBe("Second");
  });

  test("bookmark without feedback_type does not 500", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .put(`/api/lessons/${lesson._id}/bookmark/add`)
      .set("Authorization", teacher.auth)
      .send({ topic: "No type", time_from: 0, time_to: 3 });
    expect(res.status).toBeLessThan(500);
  });
});

describe("public lesson view (student)", () => {
  test("GET /api/lessons/:slug works without auth and hides bookmark questions/actions", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app).get(`/api/lessons/${lesson.id}`);
    expect(res.status).toBe(200);
    expect(res.body.lesson).toBeDefined();
    expect(res.body.lesson.name).toBe(lesson.name);
    const allowed = ["_id", "id", "name", "desc", "youtube_link", "video_source", "seconds", "minutes"];
    expect(Object.keys(res.body.lesson).filter((k) => !allowed.includes(k))).toEqual([]);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("SECRET-BOOKMARK-QUESTION");
    expect(text).not.toContain("SECRET-BOOKMARK-QACTION");
    expect(text).not.toContain("SECRET-BOOKMARK-ACTION");
    expect(text).not.toContain("SECRET-BOOKMARK-FUTURE");
  });

  test("GET /api/lessons/:_id also works and exposes no owner/watch data", async () => {
    const { lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app).get(`/api/lessons/${lesson._id}`);
    expect(res.status).toBe(200);
    expect(res.body.lesson.user).toBeUndefined();
    expect(res.body.lesson.watched).toBeUndefined();
    expect(res.body.lesson.bookmarks).toBeUndefined();
    expect(res.body.lesson.current_bookmark).toBeUndefined();
  });

  test("GET /api/lessons/:slug for unknown slug → 404", async () => {
    const res = await request(app).get("/api/lessons/does-not-exist-abc123");
    expect(res.status).toBe(404);
  });
});

describe("save analysis", () => {
  test("POST /api/lessons/:id/analysis persists", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/analysis`)
      .set("Authorization", teacher.auth)
      .send({ duration: 120, feedback_selected: "easy", topic: "Analysis topic" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.analysis)).toBe(true);
    expect(res.body.analysis).toHaveLength(1);

    const raw = await Lesson().findById(lesson._id).lean();
    expect(raw.analysis).toHaveLength(1);
    expect(raw.analysis[0].topic).toBe("Analysis topic");
    expect([].concat(raw.analysis[0].duration)).toEqual([120]);
    expect(raw.analysis[0].feedback_selected).toBe("easy");
  });
});

describe("cascading deletes", () => {
  test("deleting a lesson removes it from course.lessons and deletes its bookmarks + feedback", async () => {
    const { teacher, course, lesson, bookmark } = await F.seedTeacherWithLesson(app);
    const student = await F.signupStudent(app);
    const fb = await F.recordFeedback(app, student, lesson._id);
    expect(fb.body.success).toBe(true);

    const res = await request(app).delete(`/api/lessons/${lesson._id}`).set("Authorization", teacher.auth);
    expect(res.status).toBe(200);

    expect(await Lesson().findById(lesson._id)).toBeNull();
    const c = await Course().findById(course._id);
    expect(c.lessons.map(String)).not.toContain(String(lesson._id));
    expect(await Bookmark().findById(bookmark._id)).toBeNull();
    expect(await Feedback().countDocuments({ lesson: lesson._id })).toBe(0);
  });

  test("deleting a course cascades to its lessons, bookmarks and feedback", async () => {
    const { teacher, course, lesson, bookmark } = await F.seedTeacherWithLesson(app);
    const lesson2 = await F.addLesson(app, teacher, course._id);
    const student = await F.signupStudent(app);
    await F.recordFeedback(app, student, lesson._id);
    await F.recordFeedback(app, student, lesson2._id);

    const res = await request(app).delete(`/api/courses/${course._id}`).set("Authorization", teacher.auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(await Course().findById(course._id)).toBeNull();
    expect(await Lesson().countDocuments({ _id: { $in: [lesson._id, lesson2._id] } })).toBe(0);
    expect(await Bookmark().findById(bookmark._id)).toBeNull();
    expect(await Feedback().countDocuments({ lesson: { $in: [lesson._id, lesson2._id] } })).toBe(0);
  });
});

describe("invalid ObjectIds never 500", () => {
  let t, s;
  beforeAll(async () => {
    t = await F.signupTeacher(app);
    s = await F.signupStudent(app);
  });

  const BAD = "not-an-object-id";
  const cases = [
    ["GET course", "get", `/api/courses/${BAD}`, undefined],
    ["PUT course", "put", `/api/courses/${BAD}`, { name: "x" }],
    ["DELETE course", "delete", `/api/courses/${BAD}`, undefined],
    ["POST course lesson", "post", `/api/courses/${BAD}/lesson`, { name: "x", youtube_link: "https://youtu.be/dQw4w9WgXcQ" }],
    ["PUT lesson", "put", `/api/lessons/${BAD}`, { name: "x", youtube_link: "https://youtu.be/dQw4w9WgXcQ" }],
    ["DELETE lesson", "delete", `/api/lessons/${BAD}`, undefined],
    ["GET lesson feedback", "get", `/api/lessons/${BAD}/feedback`, undefined],
    ["POST analysis", "post", `/api/lessons/${BAD}/analysis`, { duration: 1 }],
    ["PUT bookmark add", "put", `/api/lessons/${BAD}/bookmark/add`, { topic: "x", feedback_type: ["easy"] }],
    ["PUT bookmark switch", "put", `/api/lessons/${BAD}/bookmark/switch`, { switch_to: BAD }],
    ["PUT bookmark delete", "put", `/api/lessons/${BAD}/bookmark/delete`, { delete: BAD, switch_to: BAD }],
    ["PUT bookmark save", "put", `/api/lessons/bookmark/save/${BAD}`, { topic: "x" }],
    ["PUT bookmark add-question", "put", `/api/lessons/bookmark/${BAD}/add-question`, { question: { name: "x" } }],
    ["PUT bookmark edit-questions", "put", `/api/lessons/bookmark/${BAD}/edit-questions`, { questions: [] }],
    ["PUT bookmark add-action", "put", `/api/lessons/bookmark/${BAD}/add-action`, { action: { action: "x" } }],
    ["PUT bookmark edit-actions", "put", `/api/lessons/bookmark/${BAD}/edit-actions`, { actions: [] }],
  ];

  test.each(cases)("%s with invalid id → 400/403/404", async (_n, method, url, body) => {
    let req = request(app)[method](url).set("Authorization", t.auth);
    if (body) req = req.send(body);
    const res = await req;
    expect([400, 403, 404]).toContain(res.status);
  });

  test("bookmark switch on own lesson with invalid switch_to → 400/404", async () => {
    const { teacher, lesson } = await F.seedTeacherWithLesson(app);
    const res = await request(app)
      .put(`/api/lessons/${lesson._id}/bookmark/switch`)
      .set("Authorization", teacher.auth)
      .send({ switch_to: BAD });
    expect([400, 404]).toContain(res.status);
  });

  test("student feedback on unknown lesson id does not succeed or 500", async () => {
    const res = await F.recordFeedback(app, s, "ffffffffffffffffffffffff");
    expect(res.status).toBeLessThan(500);
    expect(res.body.success).not.toBe(true);
  });
});
