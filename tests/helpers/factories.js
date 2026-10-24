const request = require("supertest");
const jwt = require("jsonwebtoken");

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

const DEFAULT_PASSWORD = "Sup3rSecret!pass";

const cookieValue = (res, name) => {
  const cookies = res.headers["set-cookie"] || [];
  for (const c of cookies) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (pair.slice(0, idx) === name) return decodeURIComponent(pair.slice(idx + 1));
  }
  return undefined;
};

const decodeToken = (bearer) => jwt.decode(String(bearer).replace(/^Bearer\s+/i, ""));

const teacherPayload = (overrides = {}) => ({
  email: `teacher_${uniq()}@example.com`,
  password: DEFAULT_PASSWORD,
  fullname: "Test Teacher",
  organization: "Test Org",
  mobile_number: "9999999999",
  feature_level: "basic",
  contact_for_research: "no",
  mode: "online",
  ...overrides,
});

const signupTeacher = async (app, overrides = {}) => {
  const body = teacherPayload(overrides);
  const res = await request(app).post("/api/auth/signup").send(body);
  if (res.status !== 200 || !res.body.jwt_token) {
    throw new Error(`teacher signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    email: body.email,
    password: body.password,
    token: res.body.jwt_token,
    auth: res.body.jwt_token.startsWith("Bearer") ? res.body.jwt_token : `Bearer ${res.body.jwt_token}`,
    id: decodeToken(res.body.jwt_token)._id,
    refreshCookie: cookieValue(res, "debe_token"),
    res,
  };
};

const signupStudent = async (app, overrides = {}) => {
  const body = {
    email: `student_${uniq()}@example.com`,
    password: DEFAULT_PASSWORD,
    name: "Test Student",
    phone: "8888888888",
    ...overrides,
  };
  const res = await request(app).post("/api/auth/student/signup").send(body);
  if (res.status !== 200 || !res.body.jwt_token) {
    throw new Error(`student signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    email: body.email,
    password: body.password,
    token: res.body.jwt_token,
    auth: res.body.jwt_token.startsWith("Bearer") ? res.body.jwt_token : `Bearer ${res.body.jwt_token}`,
    id: decodeToken(res.body.jwt_token)._id,
    refreshCookie: cookieValue(res, "debe_student_token"),
    res,
  };
};

/** Researchers have no signup route: insert one directly, then sign in through the API. */
const createResearcher = async (app, overrides = {}) => {
  const Researcher = require("../../database/models/researcher");
  const email = overrides.email || `researcher_${uniq()}@example.com`;
  const password = overrides.password || DEFAULT_PASSWORD;
  const r = new Researcher({ email, name: "Test Researcher" });
  r.password = await r.hashPassword(password);
  await r.save();
  const res = await request(app).post("/api/auth/researcher/signin").send({ email, password });
  if (res.status !== 200 || !res.body.jwt_token) throw new Error(`researcher signin failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.jwt_token;
  return { email, password, token, auth: token.startsWith("Bearer") ? token : `Bearer ${token}`, id: String(r._id), res };
};

const createCourse = async (app, teacher, name = `Course ${uniq()}`) => {
  const res = await request(app).post("/api/courses").set("Authorization", teacher.auth).send({ name });
  if (res.status !== 200 || !res.body.course) throw new Error(`createCourse failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.course;
};

const addLesson = async (app, teacher, courseId, overrides = {}) => {
  const body = {
    name: `Lesson ${uniq()}`,
    desc: "A lesson",
    youtube_link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ...overrides,
  };
  const res = await request(app).post(`/api/courses/${courseId}/lesson`).set("Authorization", teacher.auth).send(body);
  if (res.status !== 200 || !res.body.lesson) throw new Error(`addLesson failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.lesson;
};

const bookmarkPayload = (overrides = {}) => ({
  topic: "Intro topic",
  feedback_type: ["difficult"],
  activated: ["difficult", "easy"],
  time_from: 0,
  time_to: 5,
  threshold: 2,
  questions: [{ name: "SECRET-BOOKMARK-QUESTION", action: "SECRET-BOOKMARK-QACTION" }],
  actions: [{ question: 0, action: "SECRET-BOOKMARK-ACTION", future_action: "SECRET-BOOKMARK-FUTURE" }],
  ...overrides,
});

const addBookmark = async (app, teacher, lessonId, overrides = {}) => {
  const res = await request(app)
    .put(`/api/lessons/${lessonId}/bookmark/add`)
    .set("Authorization", teacher.auth)
    .send(bookmarkPayload(overrides));
  if (res.status !== 200 || !res.body.current_bookmark) throw new Error(`addBookmark failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.current_bookmark;
};

const recordFeedback = (app, student, lessonId, body = {}) =>
  request(app)
    .post(`/api/lessons/${lessonId}`)
    .set("Authorization", student.auth)
    .send({ timestamp: 30, feedback: "difficult", feedback_type: "too-fast", date_client: new Date().toISOString(), ...body });

/** Teacher A with a course, a lesson and one bookmark. */
const seedTeacherWithLesson = async (app) => {
  const teacher = await signupTeacher(app);
  const course = await createCourse(app, teacher);
  const lesson = await addLesson(app, teacher, course._id);
  const bookmark = await addBookmark(app, teacher, lesson._id);
  return { teacher, course, lesson, bookmark };
};

const binaryParser = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(Buffer.from(c)));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

module.exports = {
  uniq,
  DEFAULT_PASSWORD,
  cookieValue,
  decodeToken,
  teacherPayload,
  signupTeacher,
  signupStudent,
  createResearcher,
  createCourse,
  addLesson,
  addBookmark,
  bookmarkPayload,
  recordFeedback,
  seedTeacherWithLesson,
  binaryParser,
};
