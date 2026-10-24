const url = require("url");
const { randomString } = require("../utils/random");
const config = require("../config");
const User = require("../database/models/user");
const Token = require("../database/models/token");
const RefreshToken = require("../database/models/refresh-token");
const { setUUIDCookie, cookieOptions, clearCookie } = require("../handlers/misc");
const { sendMail } = require("../utils/mail");

const cookieName = "debe_token";

const EMAIL_COOLDOWN = process.env.NODE_ENV === "production" ? 300000 : 5000; // 5 minutes in production

const forgotPasswordMessage = "If the provided email is correct, you will receive the reset instructions there shortly";

const isNonEmptyString = (x) => typeof x === "string" && x.length > 0;

const afterAuth = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const user_id = req.user._id;
      const save_cookie = !!req.body.remember;
      const user = await User.findOne({ _id: user_id });
      setUUIDCookie(req, res);
      if (user) {
        const refresh_token = randomString({ length: 128, type: "base64url" });
        const expire_at = new Date(Date.now() + (save_cookie ? config.token.refreshExpiresIn : 86400000));
        await RefreshToken.findOneAndUpdate({ user: user_id }, { token: refresh_token, expire_at }, { upsert: true, new: true, setDefaultsOnInsert: true });

        const { token, expiry } = user.genToken();
        const cookie_opts = cookieOptions();
        if (save_cookie) cookie_opts.maxAge = config.token.refreshExpiresIn;

        res.cookie(cookieName, refresh_token, cookie_opts);
        return res.json({
          success: true,
          user: user.toWeb(),
          jwt_token: token,
          jwt_token_expiry: expiry,
        });
      }
    }
    return res.status(400).send({
      success: false,
      message: "Something went wrong.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};
const refresh = async (req, res) => {
  try {
    const refresh_token = req.cookies[cookieName];
    if (!isNonEmptyString(refresh_token)) {
      setUUIDCookie(req, res);
      return res.send({
        success: false,
        message: "Couldn't refresh tokens",
      });
    }
    const foundRT = await RefreshToken.findOne({ token: refresh_token, user: { $exists: true, $ne: null } });
    if (foundRT) {
      if (foundRT.expire_at > new Date()) {
        const user = await User.findOne({
          _id: foundRT.user,
        });
        if (user) {
          const { token, expiry } = user.genToken();
          return res.send({
            success: true,
            jwt_token: token,
            jwt_token_expiry: expiry,
            user: user.toWeb(),
          });
        }
      } else {
        const { deletedCount } = await foundRT.deleteOne();
        if (deletedCount) {
          console.log("Deleting Refresh token...", foundRT.user);
        }
      }
    }
    return res.send({
      success: false,
      message: "Couldn't refresh tokens",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
      redirect: true,
      redirectTo: "/",
    });
  }
};
// Does not require a valid access token (it may have expired): the refresh cookie identifies the session.
// Always succeeds so the client can drop its local session.
const logout = async (req, res) => {
  try {
    const refresh_token = req.cookies[cookieName];
    if (isNonEmptyString(refresh_token)) {
      await RefreshToken.findOneAndDelete({ token: refresh_token, user: { $exists: true, $ne: null } });
    }
  } catch (error) {
    console.log(error);
  }
  clearCookie(res, cookieName);
  clearCookie(res, "unique-id");
  return res.status(200).send({
    success: true,
  });
};
const update = async (req, res) => {
  return res.sendStatus(404);
};

const incrementTour = async (req, res) => {
  try {
    const _id = req.user && req.user._id;

    if (_id) {
      await User.findOneAndUpdate({ _id }, { $inc: { "tour.dashboard": 1 } });
      return res.sendStatus(200);
    }
    return res.sendStatus(401);
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const upgradeFeatureLevel = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const _id = req.user._id;

      await User.findOneAndUpdate({ _id }, { feature_level: "advanced" });

      return res.sendStatus(200);
    }
    return res.sendStatus(401);
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!isNonEmptyString(email)) {
      return res.status(400).send({ success: false, message: "Please provide a valid email." });
    }
    const now = Date.now();
    // Atomically claim the cooldown slot so concurrent requests can't send multiple mails.
    const user = await User.findOneAndUpdate(
      { email, $or: [{ last_email_request: { $eq: null } }, { last_email_request: { $lte: new Date(now) } }] },
      { last_email_request: new Date(now + EMAIL_COOLDOWN) },
      { new: true }
    );
    if (user) {
      let token = randomString({ length: 168, type: "url-safe" });
      while (await Token.exists({ token })) {
        token = randomString({ length: 168, type: "url-safe" });
      }
      // Invalidate previously issued, unused reset tokens
      await Token.updateMany({ user: user._id, used: false }, { used: true });
      const dbToken = await new Token({
        token,
        user: user._id,
      }).save();

      if (dbToken) {
        const resetPwdLink = config.app.url + "/password/reset/" + encodeURIComponent(dbToken.token);
        sendMail({
          to: user.email,
          subject: "Reset password | Tcherly",
          html: `<p>Use this link to reset your password:</p><p>${resetPwdLink}</p>`,
        }).catch(() => {
          // Already logged by utils/mail (without the link); the response stays generic on purpose
        });
      }
    }
    return res.send({ message: forgotPasswordMessage });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const findValidToken = (token, owner) =>
  Token.findOne({ token, used: false, expires_at: { $gt: new Date() }, [owner]: { $exists: true, $ne: null } });

const consumeToken = (token, owner) =>
  Token.findOneAndUpdate(
    { token, used: false, expires_at: { $gt: new Date() }, [owner]: { $exists: true, $ne: null } },
    { used: true },
    { new: true }
  );

const renderResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { message, type } = req.query;
    if (isNonEmptyString(token)) {
      const foundToken = await findValidToken(token, "user");
      if (!foundToken) {
        return res.render("info", { failed: true, message: "Provided token is not valid or has expired." });
      }
      return res.render("reset-password", {
        csrfToken: req.csrfToken(),
        type: typeof type === "string" ? type : undefined,
        message: typeof message === "string" ? message : undefined,
        token,
      });
    }
    return res.redirect(
      url.format({
        pathname: "/info",
        query: { type: "failed", message: "Token not specified" },
      })
    );
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    if (isNonEmptyString(token)) {
      const { password, confirm_password } = req.body || {};
      if (!isNonEmptyString(password) || !isNonEmptyString(confirm_password)) {
        return res.render("info", { failed: true, message: "Please provide both password and confirm password." });
      }
      if (password !== confirm_password) {
        return res.render("info", { failed: true, message: "Provided passwords do not match." });
      }
      if (password.length < 8 || password.length > 32) {
        return res.render("info", { failed: true, message: "Password length must be between 8-32 characters." });
      }
      const foundToken = await consumeToken(token, "user");
      if (!foundToken) {
        return res.render("info", { failed: true, message: "Provided token is not valid, has expired or has already been used." });
      }

      const user = await User.findOne({ _id: foundToken.user });
      if (user) {
        user.password = await user.hashPassword(password);
        const savedUser = await user.save();

        if (savedUser) {
          // Force re-login everywhere after a password change
          await RefreshToken.deleteMany({ user: user._id });
          return res.redirect("/");
        }

        return res.render("info", { failed: true, message: "Your password couldn't be changed." });
      }
    }
    return res.render("info", { failed: true, message: "Not found" });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};
module.exports = { afterAuth, logout, refresh, update, upgradeFeatureLevel, forgotPassword, renderResetPassword, resetPassword, incrementTour };
