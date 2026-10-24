const https = require("https");

const apiKey = process.env.GOOGLE_API_KEY;
const hasApiKey = !!apiKey && !apiKey.startsWith("<");

// YouTube Data API v3 (used when GOOGLE_API_KEY is set)
const API_URL = "https://www.googleapis.com/youtube/v3/videos";

// Idle (socket inactivity) timeout per request
const FETCH_TIMEOUT_MS = 10 * 1000;
// Overall deadline for a fetch, redirects and slow ("trickling") responses included
const FETCH_TOTAL_TIMEOUT_MS = 15 * 1000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_HOSTS = /(^|\.)youtube\.com$/i;

/**
 * Error whose message is safe to show to API clients.
 * Controllers should only forward `message` when `expose` is true.
 */
class YoutubeError extends Error {
  constructor(message) {
    super(message);
    this.name = "YoutubeError";
    this.expose = true;
  }
}

/**
 * GETs `url` over https and resolves to the body text. Fails on non-200 status, bodies over
 * MAX_BODY_BYTES, redirects off youtube.com, more than MAX_REDIRECTS redirects, FETCH_TIMEOUT_MS
 * of socket inactivity, or when the whole fetch (all redirects) exceeds `totalTimeoutMs`.
 */
const fetchText = (url, { totalTimeoutMs = FETCH_TOTAL_TIMEOUT_MS, redirectsLeft = MAX_REDIRECTS, deadline } = {}) =>
  new Promise((resolve, reject) => {
    const finalDeadline = deadline || Date.now() + totalTimeoutMs;
    let settled = false;
    let deadlineTimer = null;
    let req = null;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      fn(value);
    };

    const remaining = finalDeadline - Date.now();
    if (remaining <= 0) return done(reject, new Error(`YouTube fetch: exceeded total timeout (${url})`));
    deadlineTimer = setTimeout(() => {
      done(reject, new Error(`YouTube fetch: exceeded total timeout of ${totalTimeoutMs}ms (${url})`));
      if (req) req.destroy();
    }, remaining);

    const { hostname, port, pathname, search } = new URL(url);
    const headers = { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" };
    const options = { hostname, path: pathname + search, headers };
    if (port) options.port = port;

    req = https.get(options, (res) => {
      const { statusCode } = res;

      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return done(reject, new Error(`YouTube fetch: too many redirects (${url})`));
        let next;
        try {
          next = new URL(res.headers.location, url);
        } catch (error) {
          return done(reject, new Error(`YouTube fetch: invalid redirect location (${res.headers.location})`));
        }
        if (next.protocol !== "https:" || !ALLOWED_HOSTS.test(next.hostname)) {
          return done(reject, new Error(`YouTube fetch: refusing redirect to ${next.href}`));
        }
        // The overall deadline carries over to the redirected request
        if (deadlineTimer) clearTimeout(deadlineTimer);
        return fetchText(next.href, { totalTimeoutMs, redirectsLeft: redirectsLeft - 1, deadline: finalDeadline }).then(
          (body) => done(resolve, body),
          (error) => done(reject, error)
        );
      }

      if (statusCode !== 200) {
        res.resume();
        return done(reject, new Error(`YouTube fetch: unexpected status ${statusCode} (${url})`));
      }

      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        if (settled) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          req.destroy();
          return done(reject, new Error(`YouTube fetch: response exceeded ${MAX_BODY_BYTES} bytes (${url})`));
        }
        chunks.push(chunk);
      });
      res.on("end", () => done(resolve, Buffer.concat(chunks).toString("utf8")));
      res.on("error", (error) => done(reject, error));
      res.on("aborted", () => done(reject, new Error(`YouTube fetch: response aborted (${url})`)));
    });

    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy();
      done(reject, new Error(`YouTube fetch: timed out after ${FETCH_TIMEOUT_MS}ms (${url})`));
    });
    req.on("error", (error) => done(reject, error));
  });

const VIDEO_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const PATH_PREFIXES = ["embed", "v", "shorts", "live"];

/**
 * Extracts the video id from a YouTube link: youtube.com/watch?v=ID, youtu.be/ID and
 * youtube.com/{embed,v,shorts,live}/ID. Returns null for anything else.
 */
const parseVideoId = (link) => {
  if (typeof link !== "string" || !link.trim()) return null;
  let url;
  try {
    url = new URL(link.trim());
  } catch (error) {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let id = null;
  if (host === "youtu.be") {
    id = segments[0] || null;
  } else if (VIDEO_HOSTS.has(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0])) id = segments[1];
  }
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  return id;
};

/** Converts an ISO 8601 duration (YouTube's "PT1H2M3S", "P1DT2H", "PT0S") to seconds; NaN if invalid. */
const parseIsoDuration = (value) => {
  const match = typeof value === "string" && value.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match || value === "P" || value.endsWith("T")) return NaN;
  const [, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0] = match;
  return Math.round(Number(weeks) * 604800 + Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds));
};

// Fallback used when GOOGLE_API_KEY is not configured (e.g. local development)
const scrapeDuration = async (id) => {
  const html = await fetchText(`https://www.youtube.com/watch?v=${id}`);
  const match = html.match(/"lengthSeconds":"(\d+)"/);
  if (!match) throw new YoutubeError("Could not determine video duration. Check the link or try again later.");
  return parseInt(match[1], 10);
};

/** Looks the video up with the YouTube Data API v3 (global fetch, overall timeout FETCH_TOTAL_TIMEOUT_MS). */
const getDurationFromApi = async (id) => {
  const url = `${API_URL}?${new URLSearchParams({ part: "snippet,contentDetails", id, key: apiKey })}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FETCH_TOTAL_TIMEOUT_MS) });
  if (!res.ok) {
    // The API explains the failure (quotaExceeded, keyInvalid, ...) in error.errors[].reason; logged, never shown to clients
    let reason = "";
    try {
      const body = await res.json();
      reason = (body && body.error && ((body.error.errors && body.error.errors[0] && body.error.errors[0].reason) || body.error.message)) || "";
    } catch (error) {
      // non-JSON error body
    }
    throw new Error(`YouTube API: unexpected status ${res.status}${reason ? ` (${reason})` : ""}`);
  }
  const body = await res.json();
  const video = body && Array.isArray(body.items) ? body.items[0] : null;
  if (!video) throw new YoutubeError("Video not found.");
  const durationSeconds = parseIsoDuration(video.contentDetails && video.contentDetails.duration);
  if (Number.isNaN(durationSeconds)) throw new YoutubeError("Could not determine video duration.");
  return durationSeconds;
};

/**
 * Resolves the duration (in seconds) of a YouTube video.
 * Always rejects with a YoutubeError (client-safe message); the underlying
 * error is logged here and never forwarded.
 */
const getVideoDuration = async (link) => {
  const id = parseVideoId(link);
  if (!id) throw new YoutubeError("Invalid YouTube link.");

  try {
    const seconds = hasApiKey ? await getDurationFromApi(id) : await scrapeDuration(id);
    if (!(seconds > 0)) throw new YoutubeError("Could not determine video duration.");
    return seconds;
  } catch (error) {
    if (error instanceof YoutubeError) throw error;
    console.log("[youtube]", error);
    throw new YoutubeError("Could not fetch YouTube video details. Please try again later.");
  }
};

module.exports = { hasApiKey, getVideoDuration, parseVideoId, parseIsoDuration, YoutubeError, fetchText, FETCH_TIMEOUT_MS, FETCH_TOTAL_TIMEOUT_MS };
