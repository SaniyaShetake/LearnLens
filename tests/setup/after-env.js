// Never send real mail and never hit YouTube from integration tests.
jest.mock("../../utils/mail", () => ({
  sendMail: jest.fn(async () => ({ id: "<test-message-id>" })),
}));
jest.mock("../../utils/youtube", () => require("../helpers/youtube-mock").createYoutubeMock());

const mongoose = require("mongoose");

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    await mongoose.disconnect();
  }
});
