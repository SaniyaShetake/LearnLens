const mongoose = require("mongoose");

let appPromise = null;

const clearDatabase = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

/**
 * Returns the express app built by server.js#createApp() (one per test file,
 * since every test file has its own module registry). The DB is cleared the
 * first time it is created so each file starts from an empty database.
 */
const getApp = async () => {
  if (!appPromise) {
    appPromise = (async () => {
      const server = require("../../server");
      if (!server || typeof server.createApp !== "function") {
        throw new Error(
          "server.js must export `async createApp()` that connects the DB and returns the express app " +
            "(and only listens when run directly). It does not yet — integration tests cannot run."
        );
      }
      const app = await server.createApp();
      if (mongoose.connection.readyState !== 1) {
        throw new Error("createApp() resolved but mongoose is not connected (readyState=" + mongoose.connection.readyState + ")");
      }
      await clearDatabase();
      return app;
    })();
  }
  return appPromise;
};

module.exports = { getApp, clearDatabase };
