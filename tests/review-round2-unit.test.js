// Unit-level regression tests for the second review round (no HTTP app needed).
const { EventEmitter } = require("events");

describe("#3 utils/excel createSheetNamer", () => {
  const { createSheetNamer } = require("../utils/excel");

  test("names colliding after the 31-char truncation get distinct sheets", () => {
    const next = createSheetNamer();
    const long = "A".repeat(40);
    const a = next(long + "1");
    const b = next(long + "2");
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(31);
    expect(b.length).toBeLessThanOrEqual(31);
  });

  test("non-ASCII names are kept, empty/invalid names fall back, reserved names are avoided", () => {
    const next = createSheetNamer(["CLASS FEEDBACK"]);
    expect(next("李小龍")).toBe("李小龍");
    expect(next("", "Student 2")).toBe("Student 2");
    expect(next("[]*?:/\\", "Student 3")).toBe("Student 3");
    expect(next("Class Feedback").toUpperCase()).not.toBe("CLASS FEEDBACK");
    expect(next("'quoted'")).toBe("quoted");
  });

  test("never splits a surrogate pair and stays within 31 UTF-16 units", () => {
    const next = createSheetNamer();
    const name = next("😀".repeat(40));
    expect(name.length).toBeLessThanOrEqual(31);
    expect(/[\uD800-\uDBFF]$/.test(name)).toBe(false);
    const dup = next("😀".repeat(40));
    expect(dup).not.toBe(name);
    expect(dup.length).toBeLessThanOrEqual(31);
  });
});

describe("#5 sanitize depth limit", () => {
  const sanitizeMiddleware = require("../middleware/sanitize");

  const run = (body) => {
    const req = { body, query: {}, params: {} };
    const res = { status: jest.fn(() => res), send: jest.fn(() => res) };
    const next = jest.fn();
    sanitizeMiddleware(req, res, next);
    return { req, res, next };
  };

  test("too deep → 400, next() not called", () => {
    let deep = { $where: "1" };
    for (let i = 0; i < 40; i++) deep = { a: deep };
    const { res, next } = run(deep);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("deep arrays are limited too", () => {
    let deep = [1];
    for (let i = 0; i < 40; i++) deep = [deep];
    const { res, next } = run({ x: deep });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("normal input is sanitized and passed on", () => {
    const { req, next } = run({ email: { $gt: "" }, "a.b": 1, ok: { nested: [{ $ne: 1, v: 2 }] } });
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: {}, ok: { nested: [{ v: 2 }] } });
  });
});

describe("#12 utils/mail in production", () => {
  const ENV_KEYS = ["NODE_ENV", "MAIL_TRANSPORT", "MG_APIKEY", "MG_DOMAIN"];
  let saved;
  beforeEach(() => {
    saved = {};
    ENV_KEYS.forEach((k) => (saved[k] = process.env[k]));
  });
  afterEach(() => {
    ENV_KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  });

  const loadMail = (env, mailgunSend = jest.fn(async () => ({ id: "mg-id" }))) => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    Object.assign(process.env, env);
    let mod;
    jest.isolateModules(() => {
      jest.doMock("dotenv", () => ({ config: () => ({ parsed: {} }) }));
      jest.doMock("mailgun.js", () =>
        jest.fn(function Mailgun() {
          this.client = () => ({ messages: { create: mailgunSend } });
        })
      );
      mod = jest.requireActual("../utils/mail");
    });
    return { mod, mailgunSend };
  };

  const SECRET_LINK = "https://tcherly.test/password/reset/SECRET-RESET-TOKEN";
  const message = { to: "a@example.com", subject: "Reset password | Tcherly", html: `<p>${SECRET_LINK}</p>` };

  const captureConsole = () => {
    const spies = ["log", "warn", "error"].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    return {
      text: () => spies.map((s) => s.mock.calls.map((c) => c.join(" ")).join("\n")).join("\n"),
      errors: () => spies[2].mock.calls.length,
      warns: () => spies[1].mock.calls.length,
      restore: () => spies.forEach((s) => s.mockRestore()),
    };
  };

  test("production without Mailgun config and without MAIL_TRANSPORT=log: startup error, sendMail rejects, link never printed", async () => {
    const out = captureConsole();
    try {
      const { mod } = loadMail({ NODE_ENV: "production" });
      expect(mod.checkMailConfig()).toBe("disabled");
      expect(out.errors()).toBeGreaterThan(0);
      await expect(mod.sendMail(message)).rejects.toThrow(/not configured/);
      expect(out.text()).not.toMatch(/SECRET-RESET-TOKEN/);
    } finally {
      out.restore();
    }
  });

  test("production with only MG_APIKEY (no MG_DOMAIN) is also disabled", () => {
    const out = captureConsole();
    try {
      const { mod } = loadMail({ NODE_ENV: "production", MG_APIKEY: "key" });
      expect(mod.getTransport()).toBe("disabled");
    } finally {
      out.restore();
    }
  });

  test("production with explicit MAIL_TRANSPORT=log: startup warning, mail logged", async () => {
    const out = captureConsole();
    try {
      const { mod, mailgunSend } = loadMail({ NODE_ENV: "production", MAIL_TRANSPORT: "log", MG_APIKEY: "k", MG_DOMAIN: "d" });
      expect(mod.checkMailConfig()).toBe("log");
      expect(out.warns()).toBeGreaterThan(0);
      await mod.sendMail(message);
      expect(mailgunSend).not.toHaveBeenCalled();
      expect(out.text()).toMatch(/SECRET-RESET-TOKEN/);
    } finally {
      out.restore();
    }
  });

  test("production with Mailgun configured: sent via Mailgun, nothing logged; failures reject without the body", async () => {
    const out = captureConsole();
    try {
      const { mod, mailgunSend } = loadMail({ NODE_ENV: "production", MG_APIKEY: "k", MG_DOMAIN: "d" });
      expect(mod.checkMailConfig()).toBe("mailgun");
      await expect(mod.sendMail(message)).resolves.toEqual({ id: "mg-id" });
      expect(mailgunSend).toHaveBeenCalledTimes(1);
      expect(mailgunSend).toHaveBeenCalledWith("d", expect.objectContaining({ to: message.to, subject: message.subject }));

      mailgunSend.mockRejectedValueOnce(new Error("mailgun down"));
      await expect(mod.sendMail(message)).rejects.toThrow(/delivery failed/);
      expect(out.text()).not.toMatch(/SECRET-RESET-TOKEN/);
    } finally {
      out.restore();
    }
  });

  test("development without Mailgun keeps logging mail (unchanged)", async () => {
    const out = captureConsole();
    try {
      const { mod } = loadMail({ NODE_ENV: "development" });
      expect(mod.getTransport()).toBe("log");
      await expect(mod.sendMail(message)).resolves.toMatchObject({ message: "Logged (not sent)" });
      expect(out.text()).toMatch(/SECRET-RESET-TOKEN/);
    } finally {
      out.restore();
    }
  });
});

describe("#14 utils/youtube fetchText", () => {
  const loadYoutube = (httpsMock) => {
    let mod;
    process.env.GOOGLE_API_KEY = "";
    jest.isolateModules(() => {
      jest.doMock("dotenv", () => ({ config: () => ({ parsed: {} }) }));
      jest.doMock("https", () => httpsMock);
      mod = jest.requireActual("../utils/youtube");
    });
    return mod;
  };

  const makeReq = () => {
    const req = new EventEmitter();
    req.setTimeout = jest.fn(() => req);
    req.destroy = jest.fn(() => req);
    return req;
  };

  test("a response that keeps trickling data (never idle) is aborted at the total deadline", async () => {
    let timer;
    const req = makeReq();
    const https = {
      get: jest.fn((opts, cb) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = {};
        res.resume = jest.fn();
        process.nextTick(() => cb(res));
        timer = setInterval(() => res.emit("data", Buffer.from("x")), 5);
        return req;
      }),
    };
    const { fetchText } = loadYoutube(https);
    const started = Date.now();
    try {
      await expect(fetchText("https://www.youtube.com/watch?v=abc", { totalTimeoutMs: 80 })).rejects.toThrow(/total timeout/);
    } finally {
      clearInterval(timer);
    }
    expect(Date.now() - started).toBeLessThan(2000);
    expect(req.destroy).toHaveBeenCalled();
  });

  test("the deadline covers redirects too", async () => {
    const https = {
      get: jest.fn((opts, cb) => {
        const res = new EventEmitter();
        res.statusCode = 302;
        res.headers = { location: "https://www.youtube.com/next" };
        res.resume = jest.fn();
        setTimeout(() => cb(res), 30);
        return makeReq();
      }),
    };
    const { fetchText } = loadYoutube(https);
    await expect(fetchText("https://www.youtube.com/watch?v=abc", { totalTimeoutMs: 100 })).rejects.toThrow(/timeout|too many redirects/);
    expect(https.get.mock.calls.length).toBeLessThanOrEqual(4);
  });

  test("explicit ports are preserved, including across redirects", async () => {
    let call = 0;
    const https = {
      get: jest.fn((opts, cb) => {
        call += 1;
        const res = new EventEmitter();
        res.resume = jest.fn();
        if (call === 1) {
          res.statusCode = 301;
          res.headers = { location: "https://m.youtube.com:8443/watch?v=abc" };
        } else {
          res.statusCode = 200;
          res.headers = {};
        }
        process.nextTick(() => {
          cb(res);
          if (res.statusCode === 200) {
            res.emit("data", Buffer.from("ok"));
            res.emit("end");
          }
        });
        return makeReq();
      }),
    };
    const { fetchText } = loadYoutube(https);
    await expect(fetchText("https://www.youtube.com:444/watch?v=abc")).resolves.toBe("ok");
    expect(https.get.mock.calls[0][0]).toMatchObject({ hostname: "www.youtube.com", port: "444" });
    expect(https.get.mock.calls[1][0]).toMatchObject({ hostname: "m.youtube.com", port: "8443", path: "/watch?v=abc" });
  });
});
