const ExcelJS = require("exceljs");
const { randomString } = require("../utils/random");
const config = require("../config");
const Researcher = require("../database/models/researcher");
const RefreshToken = require("../database/models/refresh-token");
const Lesson = require("../database/models/lesson");
const User = require("../database/models/user");
const Feedback = require("../database/models/feedback");
const Log = require("../database/models/log");
const Student = require("../database/models/student");

const { setUUIDCookie, isValidObjectId, cookieOptions, clearCookie } = require("../handlers/misc");
const { createSheetNamer, handleExportError } = require("../utils/excel");

const cookieName = "debe_researcher_token";

const isNonEmptyString = (x) => typeof x === "string" && x.length > 0;

const researcherSignin = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const researcher_id = req.user._id;
      const save_cookie = !!req.body.remember;
      const user = await Researcher.findOne({ _id: researcher_id });
      setUUIDCookie(req, res);
      if (user) {
        const refresh_token = randomString({ length: 128, type: "base64url" });
        const expire_at = new Date(Date.now() + (save_cookie ? config.token.refreshExpiresIn : 86400000));
        await RefreshToken.findOneAndUpdate({ researcher: researcher_id }, { token: refresh_token, expire_at }, { upsert: true, new: true, setDefaultsOnInsert: true });

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

const researcherRefresh = async (req, res) => {
  try {
    const refresh_token = req.cookies[cookieName];
    if (!isNonEmptyString(refresh_token)) {
      setUUIDCookie(req, res);
      return res.send({
        success: false,
        message: "Couldn't refresh tokens",
      });
    }
    // Only tokens issued to a researcher (never teacher/student tokens stored in `user`/`student`)
    const foundRT = await RefreshToken.findOne({ token: refresh_token, researcher: { $exists: true, $ne: null } });
    const researcherId = foundRT && foundRT.researcher;
    if (foundRT && researcherId) {
      if (foundRT.expire_at > new Date()) {
        const user = await Researcher.findOne({
          _id: researcherId,
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
          console.log("Deleting Refresh token...");
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
const researcherLogout = async (req, res) => {
  try {
    const refresh_token = req.cookies[cookieName];
    if (isNonEmptyString(refresh_token)) {
      await RefreshToken.findOneAndDelete({ token: refresh_token, researcher: { $exists: true, $ne: null } });
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

const researcherLessons = async (req, res) => {
  try {
    const lessons = await Lesson.find({})
      .populate([
        { path: "user", select: "fullname email" },
        { path: "course", select: "name" },
      ])
      .exec();

    if (lessons) {
      return res.send({
        success: true,
        lessons,
      });
    }
    return res.status(404).send({
      success: false,
      message: "Not found.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const researcherExportLesson = async (req, res) => {
  try {
    const { id } = req.params;

    const lesson = isValidObjectId(id) ? await Lesson.findOne({ _id: id }) : null;
    if (lesson) {
      const feedbacks = await Feedback.find({ lesson: lesson._id });

      if (feedbacks) {
        // Send file
        return res.send({
          success: true,
        });
      }
    }

    return res.status(404).send({
      success: false,
      message: "Not found.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const researcherGetUsers = async (_, res) => {
  try {
    const users = await User.find({}).select("fullname email feature_level mode contact_for_research mobile_number organization");

    return res.send({
      success: true,
      users,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
    });
  }
};

const studentLogColumns = [
  { header: "Lesson", key: "lesson", width: 24 },
  { header: "Student Name", key: "name", width: 24 },
  { header: "Student Email", key: "email", width: 32 },
  { header: "Action", key: "action", width: 20 },
  { header: "Duration (Video Timestamp)", key: "duration", width: 20 },
  { header: "Date Timestamp", key: "createdAt", width: 30 },
];

/** @type { import('express').RequestHandler } */
const researcherGetLessonLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const query = isValidObjectId(id) ? { _id: id } : { id };

    const workbook = new ExcelJS.Workbook();

    const lesson = typeof id === "string" ? await Lesson.findOne(query) : null;

    if (!lesson) {
      return res.status(404).send({
        success: false,
        message: "Not found.",
      });
    }

    const allStudents = await Log.find({ lesson: lesson._id }).distinct("student");
    const nextSheetName = createSheetNamer();

    let idS = 0;
    while (idS < allStudents.length) {
      const studentId = allStudents[idS];

      const student = await Student.findOne({ _id: studentId });

      if (student) {
        const studentName = typeof student.name === "string" ? student.name.trim() : "";
        const worksheetName = nextSheetName(studentName.toUpperCase(), "Student " + (idS + 1));

        const worksheet = workbook.addWorksheet(worksheetName);
        worksheet.columns = studentLogColumns;

        const logs = await Log.find({ student: student._id, lesson: lesson._id }, {}, { sort: { createdAt: 1 } });

        const baseRow = {
          lesson: String(lesson._id),
          name: student.name,
          email: student.email,
        };

        let idL = 0;

        while (idL < logs.length) {
          const log = logs[idL];

          if (log) {
            const row = {
              ...baseRow,
              action: log.action,
              duration: log.duration,
              createdAt: parseInt((new Date(log.createdAt).getTime() / 1000).toFixed(0)),
            };

            worksheet.addRow(row);
          }

          idL += 1;
        }
      }

      idS += 1;
    }

    const safeId = String(lesson.id || lesson._id).replace(/[^A-Za-z0-9_-]/g, "") || "lesson";
    const filename = `lesson-${safeId}-logs-${Date.now()}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    return handleExportError(res, error);
  }
};

module.exports = {
  researcherSignin,
  researcherRefresh,
  researcherLogout,
  researcherLessons,
  researcherExportLesson,
  researcherGetUsers,
  researcherGetLessonLogs,
};
