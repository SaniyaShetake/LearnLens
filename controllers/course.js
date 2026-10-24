const Course = require("../database/models/course");
const Lesson = require("../database/models/lesson");
const { getVideoInfo } = require("../utils/video");
const { isValidObjectId, sendError, validationErrorMessage } = require("../handlers/misc");
const { saveLessonWithUniqueSlug, deleteLessonsCascade } = require("./lesson");
const { randomString } = require("../utils/random");

// Uppercase alphanumeric without ambiguous chars (O/0, I/1) — easy to read and type.
const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomString({ length: 6, characters: JOIN_CODE_CHARS });
    const exists = await Course.exists({ join_code: code });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique join code");
};

// Fields the public (student) lesson page needs. Bookmarks/analysis are teacher-only.
const PUBLIC_LESSON_FIELDS = "_id id name desc youtube_link video_source seconds minutes";

const lessonQueryFromParam = (id) => {
  if (typeof id !== "string" || !id) return null;
  return isValidObjectId(id) ? { _id: id } : { id };
};

const checkLessonBelongsToUser = async (req) => {
  try {
    const user = req.user ? req.user._id : null;
    if (!user) return false;
    // Lessons are addressed by ObjectId or by slug; anything else can't be a lesson id
    const { id } = req.params;
    if (typeof id !== "string" || !id || id.length > 256 || /\s/.test(id)) return "invalid";
    const query = lessonQueryFromParam(id);
    if (!query) return "invalid";

    const lesson = await Lesson.exists({ ...query, user });
    return !!lesson;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getAllByUser = async (req, res) => {
  try {
    const user_id = req.user ? req.user._id : null;
    const courses = await Course.find({ user: user_id })
      .sort({ createdAt: -1 })
      .exec();
    return res.send({
      success: true,
      courses: courses || [],
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

const getOneCourse = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    const user_id = req.user ? req.user._id : null;
    const course = await Course.findOne({ _id: id, user: user_id })
      .populate({ path: "lessons", match: { user: user_id } })
      .exec();
    if (course) {
      return res.send({
        success: true,
        course,
      });
    }
    return res.status(404).send({
      success: false,
      message: "Course not found",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

const createCourse = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const { name } = req.body;
      const user = req.user._id;

      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).send({
          success: false,
          message: "Provide a course name",
        });
      }

      const isTaken = await Course.findOne({ name, user });

      if (!isTaken) {
        const join_code = await generateUniqueJoinCode();
        const newCourse = await new Course({
          name,
          user,
          join_code,
        }).save();

        return res.send({
          success: true,
          course: newCourse,
        });
      }

      return res.send({
        success: false,
        message: "Couldn't create course",
      });
    }

    return res.status(401).send({
      success: false,
      message: "",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const addNewLesson = async (req, res) => {
  try {
    const { name, desc, youtube_link } = req.body;
    const { id } = req.params;
    const user_id = req.user ? req.user._id : null;

    if (!id || !isValidObjectId(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid course id",
      });
    }

    if (!name || !youtube_link)
      return res.status(400).send({
        success: false,
        message: "Provide required fields",
      });

    // Check ownership before the (slow) video lookup
    const courseExists = await Course.exists({ _id: id, user: user_id });
    if (!courseExists) {
      return res.status(404).send({
        success: false,
        message: "Course not found",
      });
    }

    let video;
    try {
      video = await getVideoInfo(youtube_link);
    } catch (error) {
      return res.status(400).send({
        success: false,
        message: error && error.expose ? error.message : "Could not fetch video details.",
      });
    }
    const durationSeconds = video.seconds;

    const newLesson = new Lesson({
      name,
      youtube_link,
      video_source: video.source,
      desc,
      seconds: durationSeconds,
      minutes: Math.ceil(durationSeconds / 60),
      course: id,
      user: user_id,
    });

    // Save the lesson first, then link it, so the course never references a missing lesson
    let savedLesson;
    try {
      savedLesson = await saveLessonWithUniqueSlug(newLesson, name);
    } catch (error) {
      const validationMessage = validationErrorMessage(error);
      if (validationMessage) return res.status(400).send({ success: false, message: validationMessage });
      throw error;
    }

    const course = await Course.findOneAndUpdate(
      { _id: id, user: user_id },
      { $addToSet: { lessons: savedLesson._id } },
      { new: true }
    );

    if (!course) {
      // Course was deleted while we were fetching from YouTube
      await Lesson.deleteOne({ _id: savedLesson._id });
      return res.status(404).send({
        success: false,
        message: "Course not found",
      });
    }

    return res.send({
      success: true,
      message: "Saved successfully",
      course,
      lesson: savedLesson,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// Public endpoint (student lesson page): only returns non-sensitive fields.
const getLesson = async (req, res) => {
  try {
    const query = lessonQueryFromParam(req.params.id);
    if (!query) {
      return res.status(404).send({ success: false, message: "Not found" });
    }

    const lesson = await Lesson.findOne(query).select(PUBLIC_LESSON_FIELDS).lean().exec();

    if (lesson) {
      return res.send({
        success: true,
        lesson,
      });
    }

    return res.status(404).send({
      success: false,
      message: "Not found",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

const editCourse = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).send({ success: false });
    }

    const id = req.params.id;
    const { name } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }

    const course = await Course.findOne({ _id: id, user: req.user._id });

    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }

    if (typeof name === "string" && name.trim()) course.name = name;

    await course.save();

    return res.send({
      success: true,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const deleteCourse = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).send({ success: false });
    }

    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }

    const course = await Course.findOneAndDelete({ _id: id, user: req.user._id });

    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }

    // Cascade: lessons of this course (owned by the same user), their bookmarks and feedback
    const lessons = await Lesson.find({
      user: req.user._id,
      $or: [{ course: course._id }, { _id: { $in: course.lessons || [] } }],
    })
      .select("_id bookmarks current_bookmark")
      .exec();

    await deleteLessonsCascade(lessons);

    return res.send({
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ success: false, message: "Internal server error" });
  }
};

const getJoinCode = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(404).send({ success: false, message: "Course not found" });

    let course = await Course.findOne({ _id: id, user: req.user._id }).select("join_code name");
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });

    // Back-fill a code for courses created before this feature was added.
    if (!course.join_code) {
      course.join_code = await generateUniqueJoinCode();
      await course.save();
    }

    return res.json({ success: true, join_code: course.join_code });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  getAllByUser,
  getOneCourse,
  createCourse,
  addNewLesson,
  getLesson,
  editCourse,
  deleteCourse,
  checkLessonBelongsToUser,
  getJoinCode,
};
