const config = require("./config");
const fs = require("fs");
const path = require("path");
const http = require("http");
const cors = require("cors");
const express = require("express");
const debug = require("debug")("debe");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const serveFavicon = require("serve-favicon");

const { db } = require("./database");
const sanitize = require("./middleware/sanitize");

const isTest = config.app.env === "test";

const logFormatter = (tokens, req, res) => {
  const url = tokens.url(req, res) || "";
  if (url.startsWith("/static/")) return null;

  const method = tokens.method(req, res);
  const date = tokens.date(req, res);
  const ip = tokens["remote-addr"](req, res);
  const status = tokens.status(req, res);

  return [Date.parse(date), ip, method, url, status, tokens["response-time"](req, res) + "ms"].join(",");
};

const corsOpts = {
  credentials: true,
  // Only origins from CORS_ORIGINS get CORS headers; requests without an Origin header are unaffected.
  origin: (origin, callback) => callback(null, !!origin && config.cors.origins.includes(origin)),
  methods: ["GET", "POST", "PUT", "DELETE"],
};

let logFileStream = null;
const getLogFileStream = () => {
  if (!logFileStream) logFileStream = fs.createWriteStream(path.join(__dirname, "debe_online.log"), { flags: "a" });
  return logFileStream;
};

/**
 * Connects to MongoDB (idempotent) and returns a fully configured express app.
 * Rejects if the database connection fails.
 */
const createApp = async () => {
  await db.connect();
  // Surfaces unique-index build failures at startup (logged, never fatal)
  await db.ensureIndexes();

  const passport = require("./middleware/passport");

  const app = express();

  app.set("trust proxy", config.app.trustProxy);
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "hbs");

  app.use(serveFavicon(path.join(__dirname, "public/favicon.ico")));
  if (config.cors.origins.length) app.use(cors(corsOpts));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sanitize);
  app.use(cookieParser());

  app.use(require("./middleware/session"));
  if (config.app.env !== "production" && !isTest) app.use(morgan("dev"));
  if (!isTest) app.use(morgan(logFormatter, { stream: getLogFileStream() }));

  app.use(passport.initialize());

  app.use(express.static(path.join(__dirname, "public")));

  app.use("/", require("./routes/index"));
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/courses", require("./routes/course"));
  app.use("/api/lessons", require("./routes/lesson"));
  app.use("/api/student", require("./routes/student"));
  app.use("/api/misc", require("./routes/misc"));
  app.use("/api/sync", require("./routes/sync"));
  app.use("/api/ai", require("./routes/ai"));
  app.use("/api/*", (_, __, next) => next(require("http-errors")(404)));

  if (config.app.env === "production") {
    // TODO: Check if static files exist
    // While building files, they disappear
    // detect that and show temporary page with building message and info

    app.use(express.static(path.join(__dirname, "client/build")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "client/build/index.html"));
    });
  }

  app.use(function (err, req, res, next) {
    // Malformed JSON / urlencoded bodies: never echo the parser's message (it quotes the input)
    if (err && (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400))) {
      if (res.headersSent) return next(err);
      return res.status(400).json({ success: false, message: "Invalid request body." });
    }
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};
    // Client errors (404, 403 bad CSRF token, ...) are expected; only log server-side failures
    if (!err.status || err.status >= 500) console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ success: false, message: err.status ? err.message : "Internal server error." });
  });

  return app;
};

function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

const start = async () => {
  // Loud startup warning/error when production mail isn't really delivered
  require("./utils/mail").checkMailConfig();

  const port = normalizePort(process.env.PORT || "3000");

  let app;
  try {
    app = await createApp();
  } catch (error) {
    console.error("Failed to start server: could not connect to MongoDB at startup.", error && error.message ? error.message : error);
    process.exit(1);
  }

  app.set("port", port);

  const server = http.createServer(app);
  server.listen(port);
  server.on("error", onError);
  server.on("listening", onListening);

  function onError(error) {
    if (error.syscall !== "listen") throw error;
    var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        process.exit(1);
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        process.exit(1);
      default:
        throw error;
    }
  }

  function onListening() {
    var addr = server.address();
    var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    debug("Listening on " + bind);
    console.log("Express server running on http://localhost:" + port);
  }

  return server;
};

if (require.main === module) {
  start();
}

module.exports = { createApp };
