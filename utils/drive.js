// Public Google Drive videos ("Anyone with the link").
//
// Browsers can't play Drive files directly: Drive answers 403 to any request carrying
// `Sec-Fetch-Site: cross-site`, which browsers always send for a <video> on another site. So the
// server streams the file to the student (GET /api/lessons/:id/video.mp4) and reads the duration
// from the MP4 header with a few small range requests, without an API key or a full download.

// Deadline for each request to Drive (response headers plus the bytes read)
const FETCH_TIMEOUT_MS = 15 * 1000;
// The first range read; covers ftyp + the start of moov for "fast start" MP4s in one request
const HEAD_BYTES = 64 * 1024;
// mvhd is the first child of moov, so the start of moov is enough
const MOOV_PEEK_BYTES = 64 * 1024;
const MAX_TOP_LEVEL_BOXES = 32;

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const RESOURCE_KEY = /^[A-Za-z0-9_-]{1,200}$/;

/** Error whose message is safe to show to API clients (same contract as YoutubeError). */
class DriveError extends Error {
  constructor(message) {
    super(message);
    this.name = "DriveError";
    this.expose = true;
  }
}

const NOT_ACCESSIBLE =
  'Could not open this Google Drive video. Make sure it is shared as "Anyone with the link", or try again later if Google is limiting downloads of it.';

/**
 * Parses a Google Drive file link: drive.google.com/file/d/ID/..., drive.google.com/file/u/N/d/ID,
 * docs.google.com/file/d/ID, and drive.google.com/{open,uc}?id=ID. Keeps the `resourcekey` query
 * parameter that older shared files need. Returns { id, resourceKey } or null.
 */
const parseDriveLink = (link) => {
  if (typeof link !== "string" || !link.trim()) return null;
  let url;
  try {
    url = new URL(link.trim());
  } catch (error) {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !DRIVE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  let id = null;
  if (parts[0] === "file") {
    const d = parts.indexOf("d");
    if (d > 0) id = parts[d + 1];
  } else if (parts.length === 1 && (parts[0] === "open" || parts[0] === "uc")) {
    id = url.searchParams.get("id");
  }
  if (!id || !FILE_ID.test(id)) return null;

  const resourceKey = url.searchParams.get("resourcekey");
  return { id, resourceKey: resourceKey && RESOURCE_KEY.test(resourceKey) ? resourceKey : null };
};

/** Direct download URL; `confirm=t` skips the "can't scan for viruses" page Drive shows for large files. */
const downloadUrl = ({ id, resourceKey }) =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t` +
  (resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : "");

/** True when Drive answered with the video itself (not a sign-in, error or quota page). */
const isVideoResponse = (res) => (res.status === 200 || res.status === 206) && /^video\//i.test(res.headers.get("content-type") || "");

/** Reads at most `max` bytes of the body, then cancels the rest (a 200 reply would be the whole file). */
const readAtMost = async (res, max) => {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (length < max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, max);
};

/** Fetches bytes [start, end] of the file. Resolves to { buffer, totalSize }. */
const fetchRange = async (file, start, end) => {
  const res = await fetch(downloadUrl(file), {
    headers: { Range: `bytes=${start}-${end}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!isVideoResponse(res)) {
    if (res.body) res.body.cancel().catch(() => {});
    const type = res.headers.get("content-type") || "";
    if (res.ok && !/^text\/html/i.test(type)) throw new DriveError("This Google Drive file is not a video.");
    throw new DriveError(NOT_ACCESSIBLE);
  }
  const range = /\/(\d+)\s*$/.exec(res.headers.get("content-range") || "");
  const totalSize = range ? Number(range[1]) : Number(res.headers.get("content-length")) || 0;
  // A 200 (range ignored) starts at byte 0
  const skip = res.status === 200 ? start : 0;
  const buffer = (await readAtMost(res, skip + end - start + 1)).subarray(skip);
  return { buffer, totalSize };
};

/** Reads an MP4/QuickTime box header at `offset` of `buf`: { size, type, headerSize } or null. */
const readBoxHeader = (buf, offset, remaining) => {
  if (offset + 8 > buf.length) return null;
  let size = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buf.length) return null;
    size = Number(buf.readBigUInt64BE(offset + 8));
    headerSize = 16;
  } else if (size === 0) {
    size = remaining; // box runs to the end of its container
  }
  if (size < headerSize) return null;
  return { size, type, headerSize };
};

/** Finds mvhd among the children at the start of a moov box and returns the duration in seconds, or null. */
const durationFromMoov = (moov) => {
  let offset = 0;
  while (offset + 8 <= moov.length) {
    const box = readBoxHeader(moov, offset, moov.length - offset);
    if (!box) return null;
    if (box.type === "mvhd") {
      const start = offset + box.headerSize;
      const version = moov[start];
      // version 0: 32-bit creation/modification times and duration; version 1: 64-bit
      const need = version === 1 ? start + 32 : start + 20;
      if (need > moov.length) return null;
      const timescale = version === 1 ? moov.readUInt32BE(start + 20) : moov.readUInt32BE(start + 12);
      const duration = version === 1 ? Number(moov.readBigUInt64BE(start + 24)) : moov.readUInt32BE(start + 16);
      // All-ones means "unknown"
      if (!timescale || !duration || duration === 0xffffffff) return null;
      const seconds = duration / timescale;
      return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    }
    offset += box.size;
  }
  return null;
};

/**
 * Walks the top-level boxes (ftyp, moov, mdat, ...) with range requests until it finds moov,
 * whether it sits at the start ("fast start") or after the media data. Returns seconds or null.
 */
const readMp4Duration = async (file) => {
  const head = await fetchRange(file, 0, HEAD_BYTES - 1);
  const totalSize = head.totalSize || head.buffer.length;
  const read = async (start, end) => {
    end = Math.min(end, totalSize - 1);
    if (end < head.buffer.length) return head.buffer.subarray(start, end + 1);
    return (await fetchRange(file, start, end)).buffer;
  };

  let offset = 0;
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES && offset + 8 <= totalSize; i++) {
    const header = await read(offset, offset + 15);
    const box = readBoxHeader(header, 0, totalSize - offset);
    if (!box) return null;
    if (box.type === "moov") {
      const end = offset + Math.min(box.size, box.headerSize + MOOV_PEEK_BYTES) - 1;
      return durationFromMoov(await read(offset + box.headerSize, end));
    }
    offset += box.size;
  }
  return null;
};

/** Duration (whole seconds, rounded up) of a public Google Drive MP4. Throws DriveError with a client-safe message. */
const getVideoDuration = async (link) => {
  const file = parseDriveLink(link);
  if (!file) throw new DriveError("Please provide a valid Google Drive link.");
  try {
    const seconds = await readMp4Duration(file);
    if (!seconds) throw new DriveError("Could not read the length of this video. Google Drive videos must be MP4 files.");
    return Math.ceil(seconds);
  } catch (error) {
    if (error instanceof DriveError) throw error;
    console.log("[drive]", error);
    throw new DriveError("Could not reach Google Drive. Please try again later.");
  }
};

module.exports = {
  DriveError,
  parseDriveLink,
  downloadUrl,
  isVideoResponse,
  getVideoDuration,
  durationFromMoov,
  FETCH_TIMEOUT_MS,
};
