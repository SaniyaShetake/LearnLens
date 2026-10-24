const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");
const { FAKE_SECONDS } = require("./helpers/youtube-mock");

let app;
const Log = () => require("../database/models/log");
const Lesson = () => require("../database/models/lesson");
const QuizQuestion = () => require("../database/models/quiz-question");

beforeAll(async () => {
  app = await getApp();
});

const setup = async () => {
  const teacher = await F.signupTeacher(app);
  const course = await F.createCourse(app, teacher);
  const lesson = await F.addLesson(app, teacher, course._id);
  const student = await F.signupStudent(app);
  return { teacher, course, lesson, student };
};

const mcq = (overrides = {}) => ({
  question: "Which law is F = ma?",
  type: "mcq",
  timestamp: 30,
  options: [
    { text: "First", isCorrect: false },
    { text: "Second", isCorrect: true },
    { text: "Third", isCorrect: false },
  ],
  ...overrides,
});

const createQuestion = (teacher, lessonId, body) =>
  request(app).post(`/api/lessons/${lessonId}/quiz`).set("Authorization", teacher.auth).send(body);

describe("clickstream logging", () => {
  test("playback positions are clamped to [0, lesson length]", async () => {
    const { lesson, student } = await setup();
    const log = (duration) =>
      request(app).post(`/api/lessons/${lesson._id}/log`).set("Authorization", student.auth).send({ action: "pause", duration });

    for (const duration of [1e12, -50, "abc", 120]) expect((await log(duration)).body.success).toBe(true);

    const durations = (await Log().find({ lesson: lesson._id }).sort({ _id: 1 })).map((l) => l.duration);
    expect(durations).toEqual([FAKE_SECONDS, 0, 0, 120]);
  });

  test("dashboard timeline stays bounded by the lesson length even with out-of-range stored data", async () => {
    const { teacher, lesson, student } = await setup();
    // Simulates rows written before positions were clamped
    await Log().create({ lesson: lesson._id, student: student.id, action: "pause", duration: 1e12 });

    const res = await request(app).get(`/api/lessons/${lesson._id}/clickstream`).set("Authorization", teacher.auth);
    expect(res.status).toBe(200);
    expect(res.body.by_minute.length).toBe(Math.ceil(FAKE_SECONDS / 60) + 1);
  });

  test("lessons without a known length are capped at 24 hours of timeline", async () => {
    const { teacher, lesson, student } = await setup();
    await Lesson().updateOne({ _id: lesson._id }, { $unset: { seconds: 1, minutes: 1 } });
    await Log().create({ lesson: lesson._id, student: student.id, action: "pause", duration: 1e12 });

    const res = await request(app).get(`/api/lessons/${lesson._id}/clickstream`).set("Authorization", teacher.auth);
    expect(res.status).toBe(200);
    expect(res.body.by_minute.length).toBe(24 * 60 + 1);
  });
});

describe("quiz question validation", () => {
  test("a valid question is created with normalized options", async () => {
    const { teacher, lesson } = await setup();
    const res = await createQuestion(teacher, lesson._id, mcq({ question: "  Which law?  " }));
    expect(res.status).toBe(201);
    expect(res.body.question.question).toBe("Which law?");
    expect(res.body.question.options.map((o) => o.isCorrect)).toEqual([false, true, false]);
  });

  test.each([
    ["missing question", { question: "" }],
    ["non-string question", { question: { a: 1 } }],
    ["invalid type", { type: "essay" }],
    ["non-numeric timestamp", { timestamp: "soon" }],
    ["null timestamp", { timestamp: null }],
    ["negative timestamp", { timestamp: -1 }],
    ["timestamp past the end of the video", { timestamp: FAKE_SECONDS + 1 }],
    ["no options", { options: [] }],
    ["a single option", { options: [{ text: "Only", isCorrect: true }] }],
    ["an option without text", { options: [{ text: "A", isCorrect: true }, { text: "  ", isCorrect: false }] }],
    ["mcq without a correct option", { options: [{ text: "A" }, { text: "B" }] }],
    ["mcq with two correct options", { options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: true }] }],
    ["msq without a correct option", { type: "msq", options: [{ text: "A" }, { text: "B" }] }],
    ["true/false without a correct option", { type: "true_false", options: [{ isCorrect: false }, { isCorrect: false }] }],
    ["true/false with both correct", { type: "true_false", options: [{ isCorrect: true }, { isCorrect: true }] }],
  ])("rejects %s with 400", async (_, overrides) => {
    const { teacher, lesson } = await setup();
    const res = await createQuestion(teacher, lesson._id, mcq(overrides));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await QuizQuestion().countDocuments({ lesson: lesson._id })).toBe(0);
  });

  test("updates are validated against the merged question; untouched options keep their ids", async () => {
    const { teacher, lesson } = await setup();
    const created = (await createQuestion(teacher, lesson._id, mcq())).body.question;
    const url = `/api/lessons/${lesson._id}/quiz/${created._id}`;

    const bad = await request(app).put(url).set("Authorization", teacher.auth).send({ type: "msq", options: [{ text: "A" }, { text: "B" }] });
    expect(bad.status).toBe(400);

    const ok = await request(app).put(url).set("Authorization", teacher.auth).send({ timestamp: 45 });
    expect(ok.status).toBe(200);
    expect(ok.body.question.timestamp).toBe(45);
    expect(ok.body.question.options.map((o) => o._id)).toEqual(created.options.map((o) => o._id));

    const badId = await request(app).put(`/api/lessons/${lesson._id}/quiz/not-an-id`).set("Authorization", teacher.auth).send({ timestamp: 1 });
    expect(badId.status).toBe(404);
  });
});

describe("quiz answers", () => {
  const answer = (student, qid, body) => request(app).post(`/api/student/quiz/${qid}/answer`).set("Authorization", student.auth).send(body);

  test("mcq: correct and wrong options are scored", async () => {
    const { teacher, lesson, student } = await setup();
    const q = (await createQuestion(teacher, lesson._id, mcq())).body.question;
    expect((await answer(student, q._id, { answer: q.options[1]._id })).body.correct).toBe(true);
    expect((await answer(student, q._id, { answer: q.options[0]._id })).body.correct).toBe(false);
  });

  test("msq: duplicates don't count twice and the exact set is required", async () => {
    const { teacher, lesson, student } = await setup();
    const q = (
      await createQuestion(teacher, lesson._id, mcq({ type: "msq", options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: true }, { text: "C" }] }))
    ).body.question;
    const [a, b] = q.options.map((o) => o._id);
    expect((await answer(student, q._id, { answer: [a, b] })).body.correct).toBe(true);
    expect((await answer(student, q._id, { answer: [a, a] })).body.correct).toBe(false);
  });

  test.each([
    ["no answer", {}],
    ["an option of another question", { answer: "000000000000000000000000" }],
    ["an array for an mcq", { answer: [] }],
    ["an object", { answer: { a: 1 } }],
  ])("rejects %s with 400 and records nothing", async (_, body) => {
    const { teacher, lesson, student } = await setup();
    const q = (await createQuestion(teacher, lesson._id, mcq())).body.question;
    const res = await answer(student, q._id, body);
    expect(res.status).toBe(400);
    expect(await require("../database/models/quiz-answer").countDocuments({ question: q._id })).toBe(0);
  });

  test("malformed question ids and questions of deleted lessons are 404", async () => {
    const { teacher, lesson, student } = await setup();
    const q = (await createQuestion(teacher, lesson._id, mcq())).body.question;

    expect((await answer(student, "not-an-id", { answer: q.options[1]._id })).status).toBe(404);

    await request(app).delete(`/api/lessons/${lesson._id}`).set("Authorization", teacher.auth).expect(200);
    expect((await answer(student, q._id, { answer: q.options[1]._id })).status).toBe(404);
  });
});
