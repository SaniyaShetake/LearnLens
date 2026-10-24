const youtube = require("./youtube");
const drive = require("./drive");

/**
 * Resolves a lesson video link to { source, seconds }: a public Google Drive file ("drive") or,
 * for anything else, a YouTube video ("youtube"). Errors carry `expose` when their message is
 * safe to show to the client.
 */
const getVideoInfo = async (link) => {
  if (drive.parseDriveLink(link)) return { source: "drive", seconds: await drive.getVideoDuration(link) };
  return { source: "youtube", seconds: await youtube.getVideoDuration(link) };
};

module.exports = { getVideoInfo };
