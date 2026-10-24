const Course = require("../database/models/course");

const PUBLIC_LESSON_FIELDS = "_id id name desc youtube_link video_source seconds minutes";

const joinCourse = async (req, res) => {
  try {
    const { join_code } = req.body;
    if (typeof join_code !== "string" || !join_code.trim()) {
      return res.status(400).send({ success: false, message: "Provide a join code." });
    }

    const course = await Course.findOne({ join_code: join_code.trim().toUpperCase() }).select("_id name join_code students");
    if (!course) return res.status(404).send({ success: false, message: "Invalid join code. Please check and try again." });

    const student_id = req.user._id;
    const alreadyEnrolled = course.students && course.students.some((s) => String(s) === String(student_id));

    if (!alreadyEnrolled) {
      await Course.updateOne({ _id: course._id }, { $addToSet: { students: student_id } });
    }

    return res.json({ success: true, already_enrolled: alreadyEnrolled, course: { _id: course._id, name: course.name } });
  } catch (error) {
    return res.status(500).send({ success: false, message: "Internal server error" });
  }
};


const getAvailableCourses = async (req, res) => {
  try {
    // Return only information students need to discover and join a course.
    const courses = await Course.find({ join_code: { $exists: true, $ne: "" } })
      .select("_id name join_code lessons students")
      .sort({ name: 1 })
      .lean();
    return res.json({
      success: true,
      courses: courses.map((course) => ({
        _id: course._id,
        name: course.name,
        join_code: course.join_code,
        lesson_count: Array.isArray(course.lessons) ? course.lessons.length : 0,
        student_count: Array.isArray(course.students) ? course.students.length : 0,
      })),
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: "Could not load available courses." });
  }
};

const getEnrolledCourses = async (req, res) => {
  try {
    const student_id = req.user._id;
    const courses = await Course.find({ students: student_id })
      .select("_id name lessons createdAt")
      .lean();
    return res.json({ success: true, courses });
  } catch (error) {
    return res.status(500).send({ success: false, message: "Internal server error" });
  }
};

const getEnrolledCourseLessons = async (req, res) => {
  try {
    const { id } = req.params;
    const student_id = req.user._id;

    const course = await Course.findOne({ _id: id, students: student_id })
      .populate({ path: "lessons", select: PUBLIC_LESSON_FIELDS })
      .lean();

    if (!course) return res.status(404).send({ success: false, message: "Course not found." });

    return res.json({ success: true, course });
  } catch (error) {
    return res.status(500).send({ success: false, message: "Internal server error" });
  }
};

module.exports = { getAvailableCourses, getEnrolledCourses, getEnrolledCourseLessons, joinCourse };
