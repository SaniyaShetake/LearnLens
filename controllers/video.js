const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const Lesson = require("../database/models/lesson");
const { isValidObjectId } = require("../handlers/misc");
const { parseDriveLink, downloadUrl, isVideoResponse } = require("../utils/drive");

// Time allowed for Drive to start answering (the body then streams for as long as the student watches)
const UPSTREAM_HEADERS_TIMEOUT_MS = 20 * 1000;
const RANGE = /^bytes=\d*-\d*$/;
const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

/**
 * GET /api/lessons/:id/video.mp4 — streams a lesson's Google Drive video (browsers can't load Drive
 * files from another site, see utils/drive.js). Public like the lesson page itself, and only for
 * links saved on a "drive" lesson, so it can't be used as a general proxy. Range requests are
 * passed through so the player can seek.
 */
const streamLessonVideo = async (req, res) => {
  const { id } = req.params;
  let file;
  try {
    const lesson = await Lesson.findOne(isValidObjectId(id) ? { _id: id } : { id }).select("youtube_link video_source").lean();
    file = lesson && lesson.video_source === "drive" ? parseDriveLink(lesson.youtube_link) : null;
  } catch (error) {
    console.log(error);
    return res.status(500).send({ success: false, message: "Internal server error" });
  }
  if (!file) return res.status(404).send({ success: false, message: "Not found" });

  const headers = {};
  const range = req.get("range");
  if (typeof range === "string" && RANGE.test(range)) headers.Range = range;

  // Stops the Drive download when the student seeks away or closes the page
  const controller = new AbortController();
  const onClose = () => controller.abort();
  res.on("close", onClose);
  const timer = setTimeout(() => controller.abort(), UPSTREAM_HEADERS_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(downloadUrl(file), { headers, signal: controller.signal });
  } catch (error) {
    if (res.destroyed || res.writableEnded) return;
    console.log("[drive] stream failed:", error && error.message);
    return res.status(502).send({ success: false, message: "Could not load the video from Google Drive." });
  } finally {
    clearTimeout(timer);
  }

  if (upstream.status === 416) {
    if (upstream.body) upstream.body.cancel().catch(() => {});
    const total = upstream.headers.get("content-range");
    if (total) res.setHeader("Content-Range", total);
    return res.status(416).end();
  }
  if (!isVideoResponse(upstream)) {
    if (upstream.body) upstream.body.cancel().catch(() => {});
    console.log(`[drive] unexpected response ${upstream.status} ${upstream.headers.get("content-type")} for lesson ${id}`);
    return res.status(502).send({ success: false, message: "Could not load the video from Google Drive." });
  }

  res.status(upstream.status);
  PASSTHROUGH_HEADERS.forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  });
  res.setHeader("Cache-Control", "private, max-age=3600");
  // Don't let a reverse proxy (nginx) buffer the whole video before sending it on
  res.setHeader("X-Accel-Buffering", "no");

  if (!upstream.body || req.method === "HEAD") {
    if (upstream.body) upstream.body.cancel().catch(() => {});
    return res.end();
  }
  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    // Players abort requests all the time (seeking, pausing, leaving); only log real failures
    if (!controller.signal.aborted && error.code !== "ERR_STREAM_PREMATURE_CLOSE") console.log("[drive] stream error:", error.message);
  } finally {
    res.off("close", onClose);
  }
};

module.exports = { streamLessonVideo };
