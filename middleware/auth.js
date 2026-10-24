const passport = require("passport");

/**
 * Like passport.authenticate(strategy, { session: false }) but, on failure, responds with
 * { success: false, message } and the status from the strategy's info (default 401) instead of
 * an empty 401, so the client can show why sign-up was rejected.
 */
const authenticateWithMessage = (strategy) => (req, res, next) =>
  passport.authenticate(strategy, { session: false }, (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      const status = info && Number.isInteger(info.status) ? info.status : 401;
      const message = info && typeof info.message === "string" ? info.message : "Unauthorized.";
      return res.status(status).send({ success: false, message });
    }
    return req.logIn(user, { session: false }, (loginError) => (loginError ? next(loginError) : next()));
  })(req, res, next);

const signupMiddleware = authenticateWithMessage("signup");
const signinMiddleware = passport.authenticate("signin", { session: false });
const verifyMiddleware = passport.authenticate("verify", { session: false });

const rSigninMiddleware = passport.authenticate("r-signin", { session: false });
const rVerifyMiddleware = passport.authenticate("r-verify", { session: false });

const studentSignupMiddleware = authenticateWithMessage("student-signup");
const studentSigninMiddleware = passport.authenticate("student-signin", { session: false });
const studentVerifyMiddleware = passport.authenticate("student-verify", { session: false });

/**
 * Ownership guard. `extractorFn(req)` resolves to:
 *  - true            → the resource exists and belongs to req.user (continue)
 *  - "invalid"       → malformed id (400)
 *  - anything else   → missing or not owned (404, so existence of other users' resources isn't revealed)
 * Authentication itself is checked earlier (401 comes from the passport middleware).
 */
const verifyResourceIsForUser = (extractorFn) => async (req, res, next) => {
  try {
    if (typeof extractorFn !== "function") return res.sendStatus(500);

    const result = await extractorFn(req);

    if (result === true) return next();
    if (result === "invalid") return res.status(400).send({ success: false, message: "Invalid id" });

    return res.status(404).send({ success: false, message: "Not found" });
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
};

// Offline client authentication is not implemented: reject every request until
// a real offline token verification exists (previously this let everything through).
const offlineMiddleware = (req, res) => {
  return res.status(401).send({ success: false, message: "Unauthorized." });
};

const signupOfflineMiddleware = (req, res, next) => {
  res.sendStatus(404);
};

const signinOfflineMiddleware = (req, res, next) => {
  res.sendStatus(404);
};

const logoutOfflineMiddleware = (req, res, next) => {
  res.sendStatus(404);
};

module.exports = {
  signupMiddleware,
  signinMiddleware,
  verifyMiddleware,
  rSigninMiddleware,
  rVerifyMiddleware,
  offlineMiddleware,
  signupOfflineMiddleware,
  signinOfflineMiddleware,
  logoutOfflineMiddleware,
  verifyResourceIsForUser,
  studentSignupMiddleware,
  studentSigninMiddleware,
  studentVerifyMiddleware,
};
