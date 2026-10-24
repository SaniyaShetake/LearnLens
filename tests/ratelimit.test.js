// Rate limits are disabled for the rest of the suite; this file builds its own
// app (fresh module registry per test file) with limits enabled.
process.env.RATE_LIMIT_DISABLED = "false";

const request = require("supertest");
const { getApp } = require("./helpers/app");
const { getSendMail } = require("./helpers/mail");

let app;
beforeAll(async () => {
  app = await getApp();
});
afterAll(() => {
  process.env.RATE_LIMIT_DISABLED = "true";
});

test.each([["/api/auth/password/forgot"], ["/api/auth/student/password/forgot"]])(
  "%s: 6th request within the window gets 429",
  async (url) => {
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post(url).send({ email: `nobody${i}@example.com` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(getSendMail()).not.toHaveBeenCalled();
  }
);

test("failed signins are limited (21st failure → 429)", async () => {
  let last;
  for (let i = 0; i < 21; i++) {
    last = await request(app).post("/api/auth/signin").send({ email: "nobody@example.com", password: "wrong-password" });
  }
  expect(last.status).toBe(429);
});

describe("student sign-in limits (a class shares one NAT IP)", () => {
  test("failures are counted per (IP + email): 21st failure for one account → 429, other accounts on the same IP unaffected", async () => {
    const target = "limited_student@example.com";
    let last;
    for (let i = 0; i < 21; i++) {
      last = await request(app).post("/api/auth/student/signin").send({ email: target, password: "wrong-password" });
    }
    expect(last.status).toBe(429);

    // Same email with different casing/whitespace is the same account key
    const again = await request(app).post("/api/auth/student/signin").send({ email: ` ${target.toUpperCase()} `, password: "wrong-password" });
    expect(again.status).toBe(429);

    const other = await request(app).post("/api/auth/student/signin").send({ email: "classmate@example.com", password: "wrong-password" });
    expect(other.status).toBe(401);
  });

  test("per-IP ceiling applies across accounts", async () => {
    const express = require("express");
    const { studentSigninLimiter } = require("../middleware/rate-limit");
    const mini = express();
    mini.use(express.json());
    mini.post("/signin", studentSigninLimiter({ perAccountMax: 20, perIpMax: 3 }), (req, res) => res.status(401).send({ success: false }));

    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await request(mini).post("/signin").send({ email: `kid${i}@example.com`, password: "x" })).status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  test("successful sign-ins are not counted", async () => {
    const express = require("express");
    const { studentSigninLimiter } = require("../middleware/rate-limit");
    const mini = express();
    mini.use(express.json());
    mini.post("/signin", studentSigninLimiter({ perAccountMax: 2, perIpMax: 2 }), (req, res) => res.status(200).send({ success: true }));
    for (let i = 0; i < 5; i++) {
      expect((await request(mini).post("/signin").send({ email: "same@example.com", password: "x" })).status).toBe(200);
    }
  });
});

describe("join course limits (join codes can't be brute-forced)", () => {
  test("wrong join codes are counted per student: 21st failure → 429, classmates on the same IP unaffected", async () => {
    const F = require("./helpers/factories");
    const guesser = await F.signupStudent(app);
    const classmate = await F.signupStudent(app);

    const statuses = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await request(app).post("/api/student/join").set("Authorization", guesser.auth).send({ join_code: `NOPE${i}` })).status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 404)).toBe(true);
    expect(statuses[20]).toBe(429);

    const other = await request(app).post("/api/student/join").set("Authorization", classmate.auth).send({ join_code: "NOPE" });
    expect(other.status).toBe(404);
  });

  test("successful joins are not counted", async () => {
    const express = require("express");
    const { joinCourseLimiter } = require("../middleware/rate-limit");
    const mini = express();
    mini.use((req, res, next) => ((req.user = { _id: "student-1" }), next()));
    mini.post("/join", joinCourseLimiter({ perAccountMax: 2, perIpMax: 2 }), (req, res) => res.status(200).send({ success: true }));
    for (let i = 0; i < 5; i++) {
      expect((await request(mini).post("/join")).status).toBe(200);
    }
  });
});
