const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const config = require("../config");

// Keep the Mongoose 5 behaviour explicitly: filter keys that are not in the schema are passed to
// MongoDB as-is (Mongoose 6 defaulted to stripping them, 7+ went back to false).
mongoose.set("strictQuery", false);
// sanitizeFilter is intentionally NOT enabled: many server-built filters use operators ($in, $gt,
// $exists/$ne, ...) that it would neutralise. User input is stripped of "$"/dotted keys by
// middleware/sanitize.js instead (see documents/NOTES.md).

// Registers every model in ./models so their indexes are built/checked at startup
const loadAllModels = () => {
  const dir = path.join(__dirname, "models");
  fs.readdirSync(dir)
    .filter((file) => file.endsWith(".js"))
    .forEach((file) => require(path.join(dir, file)));
};

class CreateConnection {
  connection = null;
  connecting = null;
  constructor() {}
  connect() {
    if (this.connection && mongoose.connection.readyState === 1) return Promise.resolve(this.connection);
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        await mongoose.connect(config.db.uri, config.db.options);
        console.log("Connected to MongoDB successfully");
        this.connection = mongoose.connection;
        return this.connection;
      } catch (error) {
        this.connection = null;
        throw error;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }
  /**
   * Waits for every registered model's index builds (Model.init()). A failed build (e.g. duplicate
   * values under a unique index) is logged loudly but does not crash the app. Resolves to the list
   * of failures ({ model, error }).
   */
  async ensureIndexes() {
    loadAllModels();
    const failures = [];
    await Promise.all(
      mongoose.modelNames().map(async (name) => {
        try {
          await mongoose.model(name).init();
        } catch (error) {
          failures.push({ model: name, error });
          console.error(
            `[db] INDEX BUILD FAILED for model "${name}": ${error && error.message ? error.message : error}\n` +
              `[db] Queries still work but uniqueness is NOT enforced for this model. ` +
              (name === "lesson"
                ? "Run `yarn migrate:slugs` (dry run) then `yarn migrate:slugs --apply` to fix lesson slugs, then restart."
                : "Fix the conflicting documents (see documents/DEPLOYMENT.md) and restart.")
          );
        }
      })
    );
    return failures;
  }
  getConnection() {
    return this.connection;
  }
  async disconnect() {
    // Wait for in-flight index builds, otherwise the driver throws "Cannot use a session that has ended"
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init().catch(() => null)));
    await mongoose.disconnect();
    this.connection = null;
  }
}

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error && error.message);
});

const db = new CreateConnection();

module.exports = {
  CreateConnection,
  db,
};
