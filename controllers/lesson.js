const Lesson = require("../database/models/lesson");
const Course = require("../database/models/course");
const Bookmark = require("../database/models/bookmark");
const Feedback = require("../database/models/feedback");
const { isValidObjectId, sendError } = require("../handlers/misc");
const { genSlug } = require("../utils/slug");
const { getVideoInfo } = require("../utils/video");

const FEEDBACK_TYPES = ["easy", "difficult", "engaging", "boring"];
const LINECHART_TYPES = [...FEEDBACK_TYPES, "net_difficult", "net_engaging"];

const isObjectId = (value) => (typeof value === "string" || (value && typeof value.toString === "function")) && isValidObjectId(String(value));

const isDuplicateSlugError = (error) =>
  !!error && error.code === 11000 && ((error.keyPattern && error.keyPattern.id) || /\bid_1\b/.test(String(error.message)));

/**
 * Assigns a fresh unique slug (`lesson.id`) derived from `name` and saves the lesson,
 * retrying when a concurrent insert grabbed the same slug (E11000 on the unique index).
 */
const saveLessonWithUniqueSlug = async (lesson, name, attempts = 5) => {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    lesson.id = genSlug(name);
    try {
      return await lesson.save();
    } catch (error) {
      if (!isDuplicateSlugError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
};

/** Returns the lesson with `_id` owned by the logged-in teacher, or null. */
const findOwnedLesson = (req, id) => {
  if (!req.user || !isObjectId(id)) return Promise.resolve(null);
  return Lesson.findOne({ _id: id, user: req.user._id });
};

/** Returns { lesson, bookmark } only when the bookmark belongs to one of req.user's lessons. */
const findOwnedBookmark = async (req, bookmark_id) => {
  if (!req.user || !isObjectId(bookmark_id)) return null;
  const lesson = await Lesson.findOne({ user: req.user._id, bookmarks: bookmark_id });
  if (!lesson) return null;
  const bookmark = await Bookmark.findOne({ _id: bookmark_id });
  if (!bookmark) return null;
  return { lesson, bookmark };
};

/** Deletes lessons and everything hanging off them (bookmarks, feedback) and unlinks them from courses. */
const deleteLessonsCascade = async (lessons = []) => {
  if (!lessons.length) return;
  const lessonIds = lessons.map((l) => l._id);
  const bookmarkIds = [];
  lessons.forEach((l) => {
    (l.bookmarks || []).forEach((b) => bookmarkIds.push(b));
    if (l.current_bookmark) bookmarkIds.push(l.current_bookmark);
  });

  if (bookmarkIds.length) await Bookmark.deleteMany({ _id: { $in: bookmarkIds } });
  await Feedback.deleteMany({ lesson: { $in: lessonIds } });
  await Course.updateMany({ lessons: { $in: lessonIds } }, { $pull: { lessons: { $in: lessonIds } } });
  await Lesson.deleteMany({ _id: { $in: lessonIds } });
};

const sanitizeTypes = (value, allowed) => {
  const arr = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return arr.filter((v) => allowed.includes(v));
};

const toNumberOrUndefined = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const notFound = (res) => res.status(404).send({ success: false, message: "Not found" });
const badId = (res) => res.status(400).send({ success: false, message: "Invalid id" });
// Validation errors (schema validators) → 400 with a message; anything else → 500
const serverError = (res, error) => sendError(res, error);

const saveLessonAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return badId(res);

    const { duration, feedback_selected, topic } = req.body;

    const entry = {
      duration: (Array.isArray(duration) ? duration : [duration]).map(toNumberOrUndefined).filter((n) => n !== undefined),
      feedback_selected: FEEDBACK_TYPES.includes(feedback_selected) ? feedback_selected : null,
      topic: typeof topic === "string" ? topic : "",
    };

    const lesson = await Lesson.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $push: { analysis: entry } },
      { new: true, runValidators: true }
    );

    if (lesson) {
      return res.send({
        success: true,
        analysis: lesson.analysis,
        message: "Updated lesson",
      });
    }

    return notFound(res);
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonAddBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return badId(res);

    const { topic, feedback_type, time_from, time_to, activated, threshold, questions, actions } = req.body;

    const lesson = await findOwnedLesson(req, id);
    if (!lesson) return notFound(res);

    const newBookmark = await new Bookmark({
      topic,
      feedback_type: sanitizeTypes(feedback_type, FEEDBACK_TYPES),
      time_from: toNumberOrUndefined(time_from),
      time_to: toNumberOrUndefined(time_to),
      threshold: toNumberOrUndefined(threshold),
      linechart_feedback: sanitizeTypes(activated, LINECHART_TYPES),
      questions: Array.isArray(questions) ? questions : [],
      actions: Array.isArray(actions) ? actions : [],
    }).save();

    const updated = await Lesson.findOneAndUpdate(
      { _id: lesson._id, user: req.user._id },
      { $addToSet: { bookmarks: newBookmark._id }, $set: { current_bookmark: newBookmark._id } },
      { new: true }
    );

    if (!updated) {
      // Lesson vanished between the lookup and the update: don't leave an orphan bookmark
      await Bookmark.deleteOne({ _id: newBookmark._id });
      return notFound(res);
    }

    const bookmarks = await Bookmark.find({ _id: { $in: updated.bookmarks } });

    return res.send({
      success: true,
      current_bookmark: newBookmark,
      bookmarks: bookmarks,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonSwitchBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const { switch_to } = req.body;
    if (!isObjectId(id)) return badId(res);
    if (!isObjectId(switch_to)) return res.status(400).send({ success: false, message: "Invalid bookmark id" });

    // The target bookmark must belong to this (owned) lesson
    const lesson = await Lesson.findOneAndUpdate(
      { _id: id, user: req.user._id, bookmarks: switch_to },
      { $set: { current_bookmark: switch_to } },
      { new: true }
    );
    if (!lesson) return notFound(res);

    const switchToBookmark = await Bookmark.findOne({ _id: switch_to });
    if (!switchToBookmark) return notFound(res);

    return res.send({
      success: true,
      current_bookmark: switchToBookmark,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonEdit = async (req, res) => {
  try {
    const { name, desc, youtube_link } = req.body;
    const id = req.params.id;
    if (!isObjectId(id)) return badId(res);

    if (!name || !youtube_link)
      return res.status(400).send({
        success: false,
        message: "Provide required fields",
      });

    const lesson = await findOwnedLesson(req, id);
    if (!lesson) return notFound(res);

    if (lesson.youtube_link !== youtube_link) {
      let video;
      try {
        video = await getVideoInfo(youtube_link);
      } catch (error) {
        return res.status(400).send({
          success: false,
          message: error && error.expose ? error.message : "Could not fetch video details.",
        });
      }

      lesson.youtube_link = youtube_link;
      lesson.video_source = video.source;
      lesson.seconds = video.seconds;
      lesson.minutes = Math.ceil(video.seconds / 60);
    }
    if (lesson.desc !== desc) lesson.desc = desc;

    // The slug (`lesson.id`) is only generated on creation: renaming keeps it, so student
    // links that were already shared keep working. (Legacy lessons without a slug get one.)
    if (lesson.name !== name) lesson.name = name;
    if (typeof lesson.id === "string" && lesson.id) {
      await lesson.save();
    } else {
      await saveLessonWithUniqueSlug(lesson, name);
    }

    return res.send({
      success: true,
      message: "Saved successfully",
      lesson,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonDelete = async (req, res) => {
  try {
    const id = req.params.id;
    if (!isObjectId(id)) return badId(res);

    const lesson = await findOwnedLesson(req, id);
    if (!lesson) return notFound(res);

    await deleteLessonsCascade([lesson]);

    return res.send({
      success: true,
      message: "Delete lesson",
    });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonSaveBookmark = async (req, res) => {
  try {
    const { bookmark_id } = req.params;
    if (!isObjectId(bookmark_id)) return badId(res);

    const { topic, activated, feedback_type, time_from, time_to, threshold } = req.body;

    const owned = await findOwnedBookmark(req, bookmark_id);
    if (!owned) return notFound(res);
    const { bookmark } = owned;

    if (topic && bookmark.topic !== topic) {
      bookmark.topic = topic;
    }
    if (activated) {
      bookmark.linechart_feedback = sanitizeTypes(activated, LINECHART_TYPES);
    }
    if (feedback_type) {
      bookmark.feedback_type = sanitizeTypes(feedback_type, FEEDBACK_TYPES);
    }
    const tf = toNumberOrUndefined(time_from);
    if (tf !== undefined) bookmark.time_from = tf;
    const tt = toNumberOrUndefined(time_to);
    if (tt !== undefined) bookmark.time_to = tt;
    const th = toNumberOrUndefined(threshold);
    if (th !== undefined) bookmark.threshold = th;

    await bookmark.save();

    return res.send({
      success: true,
      bookmark,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonDeleteBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const { delete: delete_id, switch_to } = req.body;

    if (!isObjectId(id) || !isObjectId(delete_id)) return badId(res);
    if (switch_to && (!isObjectId(switch_to) || String(switch_to) === String(delete_id))) {
      return res.status(400).send({ success: false, message: "Invalid bookmark to switch to" });
    }

    // Bookmark to delete (and the one to switch to) must both belong to this owned lesson
    const lesson = await Lesson.findOne({ _id: id, user: req.user._id, bookmarks: delete_id });
    if (!lesson) return notFound(res);

    let switchToBookmark = null;
    if (switch_to) {
      const belongs = lesson.bookmarks.some((b) => String(b) === String(switch_to));
      if (!belongs) return notFound(res);
      switchToBookmark = await Bookmark.findOne({ _id: switch_to });
      if (!switchToBookmark) return notFound(res);
    }

    const update = { $pull: { bookmarks: delete_id } };
    if (switchToBookmark) update.$set = { current_bookmark: switchToBookmark._id };
    else if (lesson.current_bookmark && String(lesson.current_bookmark) === String(delete_id)) update.$unset = { current_bookmark: 1 };

    await Lesson.updateOne({ _id: lesson._id, user: req.user._id }, update);
    await Bookmark.deleteOne({ _id: delete_id });

    return res.send({
      success: true,
      current_bookmark: switchToBookmark,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonBookmarkAddQuestion = async (req, res) => {
  try {
    const bookmark_id = req.params.bookmark_id;
    if (!isObjectId(bookmark_id)) return badId(res);
    if (!req.body.question || typeof req.body.question !== "object") {
      return res.status(400).send({ success: false, message: "Provide a question" });
    }

    const owned = await findOwnedBookmark(req, bookmark_id);
    if (!owned) return notFound(res);
    const { bookmark } = owned;

    const { name, action } = req.body.question;
    bookmark.questions.push({
      name: name,
      action: action,
      date: Date.now(),
    });

    await bookmark.save();

    return res.send({ success: true, bookmark });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonBookmarkEditQuestion = async (req, res) => {
  try {
    const bookmark_id = req.params.bookmark_id;
    const { questions } = req.body;
    if (!isObjectId(bookmark_id)) return badId(res);
    if (!Array.isArray(questions)) return res.status(400).send({ success: false, message: "Provide questions" });

    const owned = await findOwnedBookmark(req, bookmark_id);
    if (!owned) return notFound(res);
    const { bookmark } = owned;

    bookmark.questions = questions.map((q) => {
      const question = { name: q && q.name, action: q && q.action, date: (q && q.date) || Date.now() };
      if (q && isObjectId(q._id)) question._id = q._id;
      return question;
    });

    await bookmark.save();
    return res.send({ success: true, bookmark });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonBookmarkAddAction = async (req, res) => {
  try {
    const bookmark_id = req.params.bookmark_id;
    if (!isObjectId(bookmark_id)) return badId(res);
    if (!req.body.action || typeof req.body.action !== "object") {
      return res.status(400).send({ success: false, message: "Provide an action" });
    }

    const owned = await findOwnedBookmark(req, bookmark_id);
    if (!owned) return notFound(res);
    const { bookmark } = owned;

    const { question, action, future_action } = req.body.action;
    const questionIndex = parseInt(question, 10);
    bookmark.actions.push({
      question: Number.isNaN(questionIndex) ? undefined : questionIndex,
      action: action,
      future_action: future_action,
      date: Date.now(),
    });

    await bookmark.save();

    return res.send({ success: true, bookmark });
  } catch (error) {
    return serverError(res, error);
  }
};

const lessonBookmarkEditAction = async (req, res) => {
  try {
    const bookmark_id = req.params.bookmark_id;
    const { actions } = req.body;
    if (!isObjectId(bookmark_id)) return badId(res);
    if (!Array.isArray(actions)) return res.status(400).send({ success: false, message: "Provide actions" });

    const owned = await findOwnedBookmark(req, bookmark_id);
    if (!owned) return notFound(res);
    const { bookmark } = owned;

    bookmark.actions = actions.map((a) => {
      const questionIndex = parseInt(a && a.question, 10);
      const result = {
        question: Number.isNaN(questionIndex) ? undefined : questionIndex,
        action: a && a.action,
        future_action: a && a.future_action,
        date: (a && a.date) || Date.now(),
      };
      if (a && isObjectId(a._id)) result._id = a._id;
      return result;
    });

    await bookmark.save();
    return res.send({ success: true, bookmark });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  saveLessonAnalysis,
  lessonAddBookmark,
  lessonSwitchBookmark,
  lessonSaveBookmark,
  lessonBookmarkAddQuestion,
  lessonBookmarkEditQuestion,
  lessonBookmarkAddAction,
  lessonBookmarkEditAction,
  lessonEdit,
  lessonDelete,
  lessonDeleteBookmark,
  // helpers shared with controllers/course.js
  saveLessonWithUniqueSlug,
  deleteLessonsCascade,
  isObjectId,
};
