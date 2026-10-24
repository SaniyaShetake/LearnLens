// Unit tests for utils/youtube.js. https/http and global fetch (YouTube Data API) are mocked:
// these tests must never touch the network.
const { EventEmitter } = require("events");

const LINK = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/**
 * Builds a fake `https`/`http` module. `behaviour(req, options)` decides what
 * happens to each request: call `respond(status, body)` or `hang()`.
 */
const makeHttpMock = (behaviour) => {
  const calls = [];
  const request = (...args) => {
    const cb = args.find((a) => typeof a === "function");
    const opts = args.find((a) => a && typeof a === "object" && !(a instanceof URL)) || {};
    const req = new EventEmitter();
    let destroyed = false;
    req.end = jest.fn(() => req);
    req.write = jest.fn();
    req.setTimeout = jest.fn((ms, fn) => {
      if (fn) req.once("timeout", fn);
      return req;
    });
    req.destroy = jest.fn((err) => {
      if (destroyed) return req;
      destroyed = true;
      process.nextTick(() => req.emit("error", err || Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })));
      return req;
    });
    req.abort = jest.fn(() => req.destroy());
    calls.push({ args, req });

    const respond = (statusCode, body = "") => {
      const res = new EventEmitter();
      res.statusCode = statusCode;
      res.statusMessage = statusCode === 200 ? "OK" : "Error";
      res.headers = { "content-type": "text/html" };
      res.setEncoding = jest.fn();
      res.resume = jest.fn(() => res);
      res.destroy = jest.fn();
      process.nextTick(() => {
        if (cb) cb(res);
        req.emit("response", res);
        process.nextTick(() => {
          if (body) res.emit("data", Buffer.from(body));
          res.emit("end");
          res.emit("close");
        });
      });
    };
    const hang = () => {
      // Simulate the socket timing out: fire 'timeout' like Node does when
      // a `timeout` option / setTimeout() is configured. Nothing else happens.
      setTimeout(() => req.emit("timeout"), 5);
    };
    behaviour({ req, opts, respond, hang });
    return req;
  };
  return { get: jest.fn(request), request: jest.fn(request), calls, Agent: class {} };
};

/** Loads a fresh copy of utils/youtube with the given mocks. */
const loadYoutube = ({ apiKey = "", http } = {}) => {
  let mod;
  process.env.GOOGLE_API_KEY = apiKey;
  jest.isolateModules(() => {
    jest.doMock("dotenv", () => ({ config: () => ({ parsed: {} }) }));
    if (http) {
      jest.doMock("https", () => http);
      jest.doMock("http", () => http);
    }
    mod = jest.requireActual("../utils/youtube");
  });
  return mod;
};

afterEach(() => {
  process.env.GOOGLE_API_KEY = "";
  jest.dontMock("https");
  jest.dontMock("http");
  jest.restoreAllMocks();
  jest.dontMock("dotenv");
});

describe("utils/youtube without API key (page scrape fallback)", () => {
  test("parses lengthSeconds from a 200 response", async () => {
    const http = makeHttpMock(({ respond }) => respond(200, '<script>{"videoDetails":{"lengthSeconds":"125"}}</script>'));
    const yt = loadYoutube({ http });
    await expect(yt.getVideoDuration(LINK)).resolves.toBe(125);
    expect(http.calls.length).toBeGreaterThan(0);
  });

  test("non-200 response rejects with a clear message (status visible to client or in logs)", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const http = makeHttpMock(({ respond }) => respond(503, "Service Unavailable"));
      const yt = loadYoutube({ http });
      let caught;
      await yt.getVideoDuration(LINK).catch((e) => (caught = e));
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toMatch(/503|status|could not fetch|youtube/i);
      const logged = [...logSpy.mock.calls, ...errSpy.mock.calls].flat().map((x) => (x && x.message) || String(x)).join(" ");
      expect(`${caught.message} ${logged}`).toMatch(/503/);
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  test("404 response rejects (does not try to parse an error page)", async () => {
    const http = makeHttpMock(({ respond }) => respond(404, '{"lengthSeconds":"99"}'));
    const yt = loadYoutube({ http });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow();
  });

  test("request timeout rejects instead of hanging", async () => {
    const http = makeHttpMock(({ hang }) => hang());
    const yt = loadYoutube({ http });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow();
  }, 20000);

  test("network error rejects", async () => {
    const http = makeHttpMock(({ req }) => process.nextTick(() => req.emit("error", new Error("ENOTFOUND"))));
    const yt = loadYoutube({ http });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow();
  });

  test("invalid link rejects without any request", async () => {
    const http = makeHttpMock(({ respond }) => respond(200, ""));
    const yt = loadYoutube({ http });
    await expect(yt.getVideoDuration("https://example.com/not-youtube")).rejects.toThrow(/invalid/i);
    expect(http.calls).toHaveLength(0);
  });
});

describe("utils/youtube with API key (YouTube Data API v3 via fetch)", () => {
  const jsonResponse = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const videoItem = (duration) => ({ items: [{ id: "dQw4w9WgXcQ", snippet: { title: "t" }, contentDetails: { duration } }] });

  const mockFetch = (impl) => jest.spyOn(globalThis, "fetch").mockImplementation(impl);

  test("returns the duration from contentDetails (ISO 8601) and calls the videos endpoint", async () => {
    const http = makeHttpMock(({ respond }) => respond(500, ""));
    const fetchMock = mockFetch(async () => jsonResponse(200, videoItem("PT1H2M3S")));
    const yt = loadYoutube({ apiKey: "AIzaFakeKeyForTests", http });
    await expect(yt.getVideoDuration(LINK)).resolves.toBe(3723);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://www.googleapis.com/youtube/v3/videos");
    expect(parsed.searchParams.get("id")).toBe("dQw4w9WgXcQ");
    expect(parsed.searchParams.get("part")).toBe("snippet,contentDetails");
    expect(parsed.searchParams.get("key")).toBe("AIzaFakeKeyForTests");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    // The page scrape fallback is not used when an API key is configured
    expect(http.calls).toHaveLength(0);
  });

  test("no items → 'Video not found'", async () => {
    mockFetch(async () => jsonResponse(200, { items: [] }));
    const yt = loadYoutube({ apiKey: "AIzaFakeKeyForTests" });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow(/video not found/i);
  });

  test("API error status (e.g. quota) rejects with a generic, client-safe message; reason is logged", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    mockFetch(async () => jsonResponse(403, { error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } }));
    const yt = loadYoutube({ apiKey: "AIzaFakeKeyForTests" });
    const error = await yt.getVideoDuration(LINK).catch((e) => e);
    expect(error).toBeInstanceOf(yt.YoutubeError);
    expect(error.expose).toBe(true);
    expect(error.message).toMatch(/could not fetch youtube video details/i);
    expect(error.message).not.toMatch(/quota/i);
    expect(logSpy.mock.calls.flat().map((x) => (x && x.message) || String(x)).join(" ")).toMatch(/403.*quotaExceeded/);
  });

  test("network error / timeout rejects", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockFetch(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const yt = loadYoutube({ apiKey: "AIzaFakeKeyForTests" });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow(/could not fetch/i);
  });

  test("live streams / zero or invalid durations are rejected", async () => {
    mockFetch(async () => jsonResponse(200, videoItem("PT0S")));
    let yt = loadYoutube({ apiKey: "AIzaFakeKeyForTests" });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow(/could not determine video duration/i);
    jest.restoreAllMocks();
    mockFetch(async () => jsonResponse(200, videoItem("garbage")));
    yt = loadYoutube({ apiKey: "AIzaFakeKeyForTests" });
    await expect(yt.getVideoDuration(LINK)).rejects.toThrow(/could not determine video duration/i);
  });
});

describe("utils/youtube helpers", () => {
  const yt = () => loadYoutube();

  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["http://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ", "dQw4w9WgXcQ"],
    ["https://example.com/watch?v=dQw4w9WgXcQ", null],
    ["https://www.youtube.com/watch?v=bad id!", null],
    ["https://www.youtube.com/playlist?list=PL123", null],
    ["javascript:alert(1)", null],
    ["dQw4w9WgXcQ", null],
    ["", null],
    [undefined, null],
  ])("parseVideoId(%j) → %j", (link, expected) => {
    expect(yt().parseVideoId(link)).toBe(expected);
  });

  test.each([
    ["PT1H2M3S", 3723],
    ["PT4M13S", 253],
    ["PT45S", 45],
    ["P1DT1S", 86401],
    ["PT0S", 0],
    ["PT", NaN],
    ["", NaN],
    [null, NaN],
  ])("parseIsoDuration(%j) → %j", (value, expected) => {
    expect(yt().parseIsoDuration(value)).toBe(expected);
  });
});
