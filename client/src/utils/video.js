import api from "handler/api";

const YOUTUBE_URL = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
const DRIVE_HOSTS = ["drive.google.com", "docs.google.com"];
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** YouTube video id from a link, or false. */
export function isValidYouTubeUrl(url = "") {
  const match = typeof url === "string" && url.match(YOUTUBE_URL);
  return match ? match[1] : false;
}

/**
 * Google Drive file id from a share link (drive.google.com/file/d/ID/..., /open?id=ID, /uc?id=ID,
 * docs.google.com/file/d/ID), or null. Same formats as the server's utils/drive.js.
 */
export function parseDriveFileId(link = "") {
  if (typeof link !== "string" || !link.trim()) return null;
  let url;
  try {
    url = new URL(link.trim());
  } catch (error) {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !DRIVE_HOSTS.includes(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let id = null;
  if (parts[0] === "file") {
    const d = parts.indexOf("d");
    if (d > 0) id = parts[d + 1];
  } else if (parts.length === 1 && (parts[0] === "open" || parts[0] === "uc")) {
    id = url.searchParams.get("id");
  }
  return id && DRIVE_FILE_ID.test(id) ? id : null;
}

export const isValidVideoUrl = (url) => !!(isValidYouTubeUrl(url) || parseDriveFileId(url));

/** Drive's own embeddable player; fine for a preview, but it doesn't report the playback time. */
export const drivePreviewUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;

/**
 * What a lesson's player should load. Google Drive videos are streamed through the server (browsers
 * can't load them from Drive directly); the ".mp4" makes react-player use its HTML5 video player,
 * which reports time, play/pause and seeks just like the YouTube one.
 */
export function lessonVideoUrl(lesson) {
  if (!lesson) return "";
  if (lesson.video_source === "drive") return `${api.defaults.baseURL}lessons/${encodeURIComponent(lesson._id)}/video.mp4`;
  return lesson.youtube_link;
}
