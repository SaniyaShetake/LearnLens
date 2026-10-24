const request = require("supertest");
const { getApp } = require("./helpers/app");
const F = require("./helpers/factories");
const { FAKE_SECONDS } = require("./helpers/youtube-mock");

const drive = require("../utils/drive");

let app;
const Lesson = () => require("../database/models/lesson");

beforeAll(async () => {
  app = await getApp();
});

// ── Fake MP4 files ───────────────────────────────────────────────────────────

const box = (type, payload) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
};

const mvhd = ({ version = 0, timescale, duration }) => {
  if (version === 1) {
    const p = Buffer.alloc(4 + 8 + 8 + 4 + 8 + 80);
    p[0] = 1;
    p.writeUInt32BE(timescale, 20);
    p.writeBigUInt64BE(BigInt(duration), 24);
    return box("mvhd", p);
  }
  const p = Buffer.alloc(4 + 4 + 4 + 4 + 4 + 80);
  p.writeUInt32BE(timescale, 12);
  p.writeUInt32BE(duration, 16);
  return box("mvhd", p);
};

const ftyp = box("ftyp", Buffer.from("isom\0\0\x02\0isomiso2avc1mp41", "latin1"));
const moov = (opts) => box("moov", Buffer.concat([mvhd(opts), box("trak", Buffer.alloc(32))]));
const mdat = (bytes) => box("mdat", Buffer.alloc(bytes, 7));

/** "Fast start" file: moov before the media data */
const fastStartMp4 = (seconds) => Buffer.concat([ftyp, moov({ timescale: 1000, duration: seconds * 1000 }), mdat(1000)]);
/** moov after a media box larger than the first range read (64 KB) */
const moovAtEndMp4 = (seconds, opts = {}) => Buffer.concat([ftyp, mdat(200 * 1024), moov({ timescale: 90000, duration: seconds * 90000, ...opts })]);

// ── Fake Google Drive ────────────────────────────────────────────────────────

const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const driveLink = (id = FILE_ID) => `https://drive.google.com/file/d/${id}/view?usp=sharing`;

/**
 * Replaces global fetch with a Drive that serves `files[id]` (a Buffer) with Range support,
 * or an HTML page (what Drive sends for private / missing files) when the id is unknown.
 */
const fakeDrive = (files) =>
  jest.spyOn(global, "fetch").mockImplementation(async (url, opts = {}) => {
    const id = new URL(url).searchParams.get("id");
    const file = files[id];
    if (!file) return new Response("<html>Sign in</html>", { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
    if (file === "pdf") return new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } });

    const range = /^bytes=(\d*)-(\d*)$/.exec((opts.headers && opts.headers.Range) || "");
    if (!range) return new Response(file, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(file.length) } });
    const start = Number(range[1]);
    if (start >= file.length) return new Response("", { status: 416, headers: { "content-range": `bytes */${file.length}` } });
    const end = Math.min(range[2] ? Number(range[2]) : file.length - 1, file.length - 1);
    return new Response(file.subarray(start, end + 1), {
      status: 206,
      headers: { "content-type": "video/mp4", "content-range": `bytes ${start}-${end}/${file.length}`, "accept-ranges": "bytes" },
    });
  });

afterEach(() => jest.restoreAllMocks());

// ── Tests ────────────────────────────────────────────────────────────────────

describe("parseDriveLink", () => {
  test.each([
    [`https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`, FILE_ID],
    [`https://drive.google.com/file/d/${FILE_ID}`, FILE_ID],
    [`https://drive.google.com/file/u/1/d/${FILE_ID}/view`, FILE_ID],
    [`https://docs.google.com/file/d/${FILE_ID}/edit`, FILE_ID],
    [`https://drive.google.com/open?id=${FILE_ID}`, FILE_ID],
    [`https://drive.google.com/uc?export=download&id=${FILE_ID}`, FILE_ID],
    [`  https://drive.google.com/file/d/${FILE_ID}/preview  `, FILE_ID],
  ])("%s", (link, id) => {
    expect(drive.parseDriveLink(link)).toEqual({ id, resourceKey: null });
  });

  test("keeps the resource key older shared files need", () => {
    expect(drive.parseDriveLink(`https://drive.google.com/file/d/${FILE_ID}/view?resourcekey=0-abc_DEF`)).toEqual({ id: FILE_ID, resourceKey: "0-abc_DEF" });
    expect(drive.downloadUrl({ id: FILE_ID, resourceKey: "0-abc_DEF" })).toMatch(/&confirm=t&resourcekey=0-abc_DEF$/);
  });

  test.each([
    ["a YouTube link", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["another host", `https://evil.example.com/file/d/${FILE_ID}/view`],
    ["a folder", "https://drive.google.com/drive/folders/1WiD__L8lxbvKFBg2qAbNT66AeC9d2V4D"],
    ["a too-short id", "https://drive.google.com/file/d/abc/view"],
    ["an id with odd characters", "https://drive.google.com/open?id=abc%2F..%2Fdefghijk"],
    ["a non-http scheme", `javascript://drive.google.com/file/d/${FILE_ID}`],
    ["not a URL", "drive.google.com/file/d/" + FILE_ID],
    ["a non-string", { id: FILE_ID }],
  ])("rejects %s", (_, link) => {
    expect(drive.parseDriveLink(link)).toBeNull();
  });
});

describe("getVideoDuration", () => {
  test("reads the duration of a fast-start MP4 in one request", async () => {
    const fetchSpy = fakeDrive({ [FILE_ID]: fastStartMp4(754) });
    expect(await drive.getVideoDuration(driveLink())).toBe(754);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe(`https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download&confirm=t`);
    expect(opts.headers.Range).toBe("bytes=0-65535");
  });

  test("finds moov after the media data (version 1 mvhd, fractional seconds round up)", async () => {
    // 406836000 / 90000 = 4520.4 s
    fakeDrive({ [FILE_ID]: moovAtEndMp4(0, { version: 1, timescale: 90000, duration: 406836000 }) });
    expect(await drive.getVideoDuration(driveLink())).toBe(4521);
  });

  test("handles 64-bit (largesize) box headers", async () => {
    const big = Buffer.alloc(16);
    big.writeUInt32BE(1, 0);
    big.write("mdat", 4, "latin1");
    big.writeBigUInt64BE(BigInt(16 + 100 * 1024), 8);
    const file = Buffer.concat([ftyp, big, Buffer.alloc(100 * 1024), moov({ timescale: 600, duration: 600 * 90 })]);
    fakeDrive({ [FILE_ID]: file });
    expect(await drive.getVideoDuration(driveLink())).toBe(90);
  });

  test.each([
    ["a private or missing file", "missing", /Anyone with the link/],
    ["a file that isn't a video", "pdf", /not a video/],
    ["an MP4 without a duration", "nomoov", /must be MP4/],
    ["a duration marked unknown", "unknown", /must be MP4/],
  ])("explains %s", async (_, kind, message) => {
    const files = {
      pdf: "pdf",
      nomoov: Buffer.concat([ftyp, mdat(500)]),
      unknown: Buffer.concat([ftyp, moov({ timescale: 1000, duration: 0xffffffff })]),
    };
    fakeDrive({ [FILE_ID]: files[kind] });
    await expect(drive.getVideoDuration(driveLink())).rejects.toMatchObject({ expose: true, message: expect.stringMatching(message) });
  });

  test("network failures become a client-safe error", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    jest.spyOn(console, "log").mockImplementation(() => {});
    await expect(drive.getVideoDuration(driveLink())).rejects.toMatchObject({ expose: true, message: "Could not reach Google Drive. Please try again later." });
  });

  test("never reads more than it asked for when Drive ignores the Range header", async () => {
    const file = fastStartMp4(30);
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response(file, { status: 200, headers: { "content-type": "video/mp4" } }));
    expect(await drive.getVideoDuration(driveLink())).toBe(30);
  });
});

describe("Drive lessons", () => {
  const setup = async () => {
    const teacher = await F.signupTeacher(app);
    const course = await F.createCourse(app, teacher);
    return { teacher, course };
  };

  test("a lesson can be created from a public Drive link", async () => {
    fakeDrive({ [FILE_ID]: fastStartMp4(754) });
    const { teacher, course } = await setup();
    const lesson = await F.addLesson(app, teacher, course._id, { youtube_link: driveLink() });
    expect(lesson.video_source).toBe("drive");
    expect(lesson.seconds).toBe(754);
    expect(lesson.minutes).toBe(13);

    // Students see the source on the public lesson page
    const pub = await request(app).get(`/api/lessons/${lesson.id}`);
    expect(pub.body.lesson.video_source).toBe("drive");
  });

  test("YouTube lessons keep working and are marked as YouTube", async () => {
    const { teacher, course } = await setup();
    const lesson = await F.addLesson(app, teacher, course._id);
    expect(lesson.video_source).toBe("youtube");
    expect(lesson.seconds).toBe(FAKE_SECONDS);
  });

  test("a private Drive file is rejected with a helpful message", async () => {
    fakeDrive({});
    const { teacher, course } = await setup();
    const res = await request(app).post(`/api/courses/${course._id}/lesson`).set("Authorization", teacher.auth).send({ name: "Private", youtube_link: driveLink() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Anyone with the link/);
    expect(await Lesson().countDocuments({ course: course._id })).toBe(0);
  });

  test("editing switches a lesson between YouTube and Drive", async () => {
    fakeDrive({ [FILE_ID]: fastStartMp4(120) });
    const { teacher, course } = await setup();
    const lesson = await F.addLesson(app, teacher, course._id);
    const edit = (youtube_link) =>
      request(app).put(`/api/lessons/${lesson._id}`).set("Authorization", teacher.auth).send({ name: lesson.name, desc: lesson.desc, youtube_link });

    const toDrive = await edit(driveLink());
    expect(toDrive.status).toBe(200);
    expect(toDrive.body.lesson).toMatchObject({ video_source: "drive", seconds: 120, minutes: 2 });

    const toYoutube = await edit("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(toYoutube.body.lesson).toMatchObject({ video_source: "youtube", seconds: FAKE_SECONDS });
  });
});

describe("GET /api/lessons/:id/video.mp4", () => {
  const file = fastStartMp4(60);

  const driveLesson = async () => {
    fakeDrive({ [FILE_ID]: file });
    const teacher = await F.signupTeacher(app);
    const course = await F.createCourse(app, teacher);
    return { teacher, lesson: await F.addLesson(app, teacher, course._id, { youtube_link: driveLink() }) };
  };
  const get = (path, headers = {}) => request(app).get(path).set(headers).buffer(true).parse(F.binaryParser);

  test("streams byte ranges so the player can seek (by id or slug, no login needed)", async () => {
    const { lesson } = await driveLesson();
    for (const key of [lesson._id, lesson.id]) {
      const res = await get(`/api/lessons/${key}/video.mp4`, { Range: "bytes=8-23" });
      expect(res.status).toBe(206);
      expect(res.headers["content-type"]).toBe("video/mp4");
      expect(res.headers["content-range"]).toBe(`bytes 8-23/${file.length}`);
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(Buffer.compare(res.body, file.subarray(8, 24))).toBe(0);
    }
  });

  test("streams the whole file without a Range header", async () => {
    const { lesson } = await driveLesson();
    const res = await get(`/api/lessons/${lesson._id}/video.mp4`);
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body, file)).toBe(0);
  });

  test("passes Drive's 416 through for ranges past the end", async () => {
    const { lesson } = await driveLesson();
    const res = await get(`/api/lessons/${lesson._id}/video.mp4`, { Range: `bytes=${file.length + 10}-` });
    expect(res.status).toBe(416);
    expect(res.headers["content-range"]).toBe(`bytes */${file.length}`);
  });

  test("only well-formed Range headers are forwarded to Drive", async () => {
    const { lesson } = await driveLesson();
    const before = global.fetch.mock.calls.length;
    for (const Range of ["bytes=0-1, 5-6", "items=0-5", "bytes=abc"]) {
      expect((await get(`/api/lessons/${lesson._id}/video.mp4`, { Range })).status).toBe(200);
    }
    const streamCalls = global.fetch.mock.calls.slice(before);
    expect(streamCalls).toHaveLength(3);
    streamCalls.forEach(([, opts]) => expect(opts.headers.Range).toBeUndefined());
  });

  test("404 for YouTube lessons and unknown lessons (not a general proxy)", async () => {
    const teacher = await F.signupTeacher(app);
    const course = await F.createCourse(app, teacher);
    const yt = await F.addLesson(app, teacher, course._id);
    const fetchSpy = jest.spyOn(global, "fetch");
    expect((await get(`/api/lessons/${yt._id}/video.mp4`)).status).toBe(404);
    expect((await get(`/api/lessons/000000000000000000000000/video.mp4`)).status).toBe(404);
    expect((await get(`/api/lessons/no-such-slug/video.mp4`)).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("502 when Drive stops serving the file (unshared later, quota page, network error)", async () => {
    const { lesson } = await driveLesson();
    jest.spyOn(console, "log").mockImplementation(() => {});

    fakeDrive({});
    const unshared = await get(`/api/lessons/${lesson._id}/video.mp4`);
    expect(unshared.status).toBe(502);

    global.fetch.mockRejectedValueOnce(new Error("ECONNRESET"));
    const down = await get(`/api/lessons/${lesson._id}/video.mp4`);
    expect(down.status).toBe(502);
  });
});
