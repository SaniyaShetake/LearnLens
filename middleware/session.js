const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const config = require("../config");
const { db } = require("../database");

module.exports = session({
  name: "sessionId",
  secret: config.session.secret,
  cookie: {
    secure: config.app.env === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: config.session.maxAge,
  },
  resave: false,
  saveUninitialized: false,
  // Reuses the mongoose connection's MongoClient (db.connect() must have resolved before this module is required)
  store: MongoStore.create({ client: db.getConnection().getClient() }),
});
