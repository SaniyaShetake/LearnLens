// Fake replacement for utils/youtube used in all integration tests.
const FAKE_SECONDS = 600;

const fakeVideo = () => ({
  id: "dQw4w9WgXcQ",
  title: "Fake test video",
  description: "Fake",
  durationSeconds: FAKE_SECONDS,
  duration: { hours: 0, minutes: 10, seconds: 0 },
  thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
  thumbnails: { default: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg" } },
});

const createYoutubeMock = () => ({
  hasApiKey: false,
  getVideoDuration: jest.fn(async () => FAKE_SECONDS),
  getVideo: jest.fn(async () => fakeVideo()),
  getVideoDetails: jest.fn(async () => fakeVideo()),
  fetchText: jest.fn(async () => ""),
});

module.exports = { createYoutubeMock, fakeVideo, FAKE_SECONDS };
