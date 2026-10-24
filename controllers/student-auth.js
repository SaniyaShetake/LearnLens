const url = require("url");
const { randomString } = require("../utils/random");
const config = require("../config");
const Student = require("../database/models/student");
const Token = require("../database/models/token");
const Lesson = require("../database/models/lesson");
const RefreshToken = require("../database/models/refresh-token");
const Log = require("../database/models/log");
const { setUUIDCookie, isValidObjectId, cookieOptions, clearCookie } = require("../handlers/misc");
const { sendMail } = require("../utils/mail");
const { onLogFail } = require("../utils/log");

const cookieName = "debe_student_token";

const EMAIL_COOLDOWN = process.env.NODE_ENV === "production" ? 300000 : 5000; // 5 minutes in production

const isNonEmptyString = (x) => typeof x === "string" && x.length > 0;

const findLessonByAnyId = async (lesson_id) => {
  if (!isNonEmptyString(lesson_id)) return null;
  return Lesson.findOne(isValidObjectId(lesson_id) ? { _id: lesson_id } : { id: lesson_id });
};

const afterStudentAuth = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const student_id = req.user._id;
      const save_cookie = !!req.body.remember;
      const { lesson_id } = req.body;

      const student = await Student.findOne({ _id: student_id });

      if (student) {
        const refresh_token = randomString({ length: 128, type: "base64url" });
        const expire_at = new Date(Date.now() + (save_cookie ? config.token.refreshExpiresIn : 86400000));
        await RefreshToken.findOneAndUpdate({ student: student_id }, { token: refresh_token, expire_at }, { upsert: true, new: true, setDefaultsOnInsert: true });

        const { token, expiry } = student.genToken();

        const cookie_opts = cookieOptions();
        if (save_cookie) cookie_opts.maxAge = config.token.refreshExpiresIn;

        const lesson = await findLessonByAnyId(lesson_id);

        try {
          await new Log({
            action: "login",
            student: student_id,
            lesson: lesson ? lesson._id : null,
          }).save();
        } catch (error) {
          onLogFail({
            action: "login",
            student: student_id,
            lesson: lesson ? lesson._id : null,
          });
          console.log(error);
        }

        res.cookie(cookieName, refresh_token, cookie_opts);

        return res.json({
          success: true,
          user: student.toWeb(),
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

const studentRefresh = async (req, res) => {
  try {
    const refresh_token = req.cookies[cookieName];

    if (!isNonEmptyString(refresh_token)) {
      setUUIDCookie(req, res);
      return res.send({
        success: false,
        message: "Couldn't refresh tokens",
      });
    }

    const foundRT = await RefreshToken.findOne({ token: refresh_token, student: { $exists: true, $ne: null } });
    if (foundRT) {
      if (foundRT.expire_at > new Date()) {
        const student = await Student.findOne({
          _id: foundRT.student,
        });

        if (student) {
          const { token, expiry } = student.genToken();

          return res.send({
            success: true,
            jwt_token: token,
            jwt_token_expiry: expiry,
            user: student.toWeb(),
          });
        }
      } else {
        const { deletedCount } = await foundRT.deleteOne();
        if (deletedCount) {
          console.log("Deleting Refresh token...", foundRT.student);
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
const studentLogout = async (req, res) => {
  try {
    const refresh_token = req.cookies[cookieName];
    const { lesson_id } = req.body || {};
    const deleted = isNonEmptyString(refresh_token)
      ? await RefreshToken.findOneAndDelete({ token: refresh_token, student: { $exists: true, $ne: null } })
      : null;

    if (deleted) {
      const lesson = await findLessonByAnyId(lesson_id);
      const logEntry = {
        action: "logout",
        student: deleted.student,
        lesson: lesson ? lesson._id : null,
      };
      try {
        await new Log(logEntry).save();
      } catch (error) {
        onLogFail(logEntry);
        console.log(error);
      }
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

const studentForgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!isNonEmptyString(email)) {
      return res.status(400).send({ success: false, message: "Please provide a valid email." });
    }
    const now = Date.now();
    // Atomically claim the cooldown slot so concurrent requests can't send multiple mails.
    const student = await Student.findOneAndUpdate(
      { email, $or: [{ last_email_request: { $eq: null } }, { last_email_request: { $lte: new Date(now) } }] },
      { last_email_request: new Date(now + EMAIL_COOLDOWN) },
      { new: true }
    );

    if (student) {
      let token = randomString({ length: 168, type: "url-safe" });
      while (await Token.exists({ token })) {
        token = randomString({ length: 168, type: "url-safe" });
      }

      // Invalidate previously issued, unused reset tokens
      await Token.updateMany({ student: student._id, used: false }, { used: true });
      const dbToken = await new Token({
        token,
        student: student._id,
      }).save();

      if (dbToken) {
        const resetPwdLink = config.app.url + "/student/password/reset/" + encodeURIComponent(dbToken.token);
        sendMail({
          to: student.email,
          subject: "Reset password | Tcherly",
          html: `<p>Use this link to reset your password:</p><p>${resetPwdLink}</p>`,
        }).catch(() => {
          // Already logged by utils/mail (without the link); the response stays generic on purpose
        });
      }
    }
    return res.send({ message: "If the provided email is correct, you will receive the reset instructions there shortly." });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const findValidToken = (token) =>
  Token.findOne({ token, used: false, expires_at: { $gt: new Date() }, student: { $exists: true, $ne: null } });

const consumeToken = (token) =>
  Token.findOneAndUpdate(
    { token, used: false, expires_at: { $gt: new Date() }, student: { $exists: true, $ne: null } },
    { used: true },
    { new: true }
  );

const renderStudentResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { message, type } = req.query;

    if (isNonEmptyString(token)) {
      const foundToken = await findValidToken(token);
      if (!foundToken) {
        return res.render("info", { failed: true, message: "Provided token is not valid or has expired." });
      }
      return res.render("student-reset-password", {
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

const studentResetPassword = async (req, res) => {
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
      const foundToken = await consumeToken(token);
      if (!foundToken) {
        return res.render("info", { failed: true, message: "Provided token is not valid, has expired or has already been used." });
      }

      const student = await Student.findOne({ _id: foundToken.student });
      if (student) {
        student.password = await student.hashPassword(password);
        const savedUser = await student.save();

        if (savedUser) {
          // Force re-login everywhere after a password change
          await RefreshToken.deleteMany({ student: student._id });
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

module.exports = { afterStudentAuth, studentRefresh, studentLogout, studentForgotPassword, renderStudentResetPassword, studentResetPassword };
