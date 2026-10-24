const Student = require("../database/models/student");
const Lesson = require("../database/models/lesson");
const Log = require("../database/models/log");
const { isValidObjectId } = require("../handlers/misc");
const { onLogFail } = require("../utils/log");

const CLICKSTREAM_ACTIONS = ["play", "pause", "forward_seek", "backward_seek"];
// Upper bound for the clickstream timeline when the lesson length is unknown (24 hours of video).
const MAX_TIMELINE_MINUTES = 24 * 60;

const lessonLengthSeconds = (lesson) => lesson.seconds || (lesson.minutes || 0) * 60;

/** Playback position from the client, clamped to [0, lesson length] (0 when not a finite number). */
const clampDuration = (value, lesson) => {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) return 0;
  const length = lessonLengthSeconds(lesson);
  return length ? Math.min(duration, length) : duration;
};

/** @type { import('express').RequestHandler } */
const logInteraction = async (req, res) => {
  const { action, date_client } = req.body;
  const { id } = req.params;

  const query = {};
  if (isValidObjectId(id)) query._id = id;
  else query.id = id;

  try {
    const user_id = req.user ? req.user._id : null;

    const lesson = await Lesson.findOne(query);
    const student = await Student.findOne({ _id: user_id });

    if (lesson && student) {
      const data = {
        student: student._id,
        lesson: lesson._id,
        action: action,
        date_client: date_client,
      };

      data.duration = clampDuration(req.body.duration, lesson);

      try {
        await new Log(data).save();

        return res.send({ success: true });
      } catch (error) {
        onLogFail(data);
      }
    }
    return res.send({ success: false });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ success: false });
  }
};

/** @type { import('express').RequestHandler } */
const getClickstream = async (req, res) => {
  const { id } = req.params;
  const query = {};
  if (isValidObjectId(id)) query._id = id;
  else query.id = id;

  try {
    const lesson = await Lesson.findOne({ ...query, user: req.user._id });
    if (!lesson) return res.status(404).json({ success: false, message: "Lesson not found" });

    // Per-minute per-action counts via aggregation
    const byMinuteRaw = await Log.aggregate([
      { $match: { lesson: lesson._id, action: { $in: CLICKSTREAM_ACTIONS } } },
      {
        $group: {
          _id: {
            action: "$action",
            minute: { $floor: { $divide: [{ $ifNull: ["$duration", 0] }, 60] } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.minute": 1 } },
    ]);

    // Build per-minute map
    const minuteMap = {};
    byMinuteRaw.forEach(({ _id, count }) => {
      const m = Math.max(0, Math.floor(_id.minute));
      if (!minuteMap[m]) minuteMap[m] = { play: 0, pause: 0, forward_seek: 0, backward_seek: 0 };
      minuteMap[m][_id.action] = count;
    });

    // Fill gaps so timeline is continuous up to lesson length. Bounded by the lesson length so
    // out-of-range positions stored by older versions can't blow up the timeline.
    const totalMinutes = lesson.minutes ? Math.ceil(lesson.minutes) : 0;
    const maxMinute = totalMinutes || Math.min(MAX_TIMELINE_MINUTES, Object.keys(minuteMap).reduce((max, m) => Math.max(max, Number(m)), 0));
    const byMinute = [];
    for (let m = 0; m <= maxMinute; m++) {
      const row = minuteMap[m] || { play: 0, pause: 0, forward_seek: 0, backward_seek: 0 };
      byMinute.push({ minute: m, ...row, total: row.play + row.pause + row.forward_seek + row.backward_seek });
    }

    // Summary
    const summary = { play: 0, pause: 0, forward_seek: 0, backward_seek: 0 };
    byMinuteRaw.forEach(({ _id, count }) => { summary[_id.action] = (summary[_id.action] || 0) + count; });
    summary.total_events = summary.play + summary.pause + summary.forward_seek + summary.backward_seek;

    // Unique students
    const uniqueStudents = await Log.distinct("student", { lesson: lesson._id, action: { $in: CLICKSTREAM_ACTIONS } });
    summary.unique_students = uniqueStudents.length;

    // Hotspots: top 3 minutes per action
    const topN = (action) =>
      [...byMinute]
        .filter((r) => r[action] > 0)
        .sort((a, b) => b[action] - a[action])
        .slice(0, 3)
        .map((r) => ({ minute: r.minute, count: r[action] }));

    // Student-level view (distinct students, not raw events): raw play/pause counts mostly measure how
    // often people resume, so the dashboard shows "how many students jumped back / skipped / paused here".
    const studentMinuteRaw = await Log.aggregate([
      { $match: { lesson: lesson._id, action: { $in: ["pause", "forward_seek", "backward_seek"] } } },
      {
        $group: {
          _id: { action: "$action", minute: { $floor: { $divide: [{ $ifNull: ["$duration", 0] }, 60] } }, student: "$student" },
        },
      },
      { $group: { _id: { action: "$_id.action", minute: "$_id.minute" }, students: { $sum: 1 } } },
    ]);
    // Furthest point each student reached (estimate of retention; seeks and pauses carry the position)
    const furthest = await Log.aggregate([
      { $match: { lesson: lesson._id, student: { $ne: null } } },
      { $group: { _id: "$student", max: { $max: { $ifNull: ["$duration", 0] } } } },
    ]);
    const distinctFor = (action) => Log.distinct("student", { lesson: lesson._id, action });
    const [backStudents, skipStudents, pauseStudents] = await Promise.all(["backward_seek", "forward_seek", "pause"].map(distinctFor));

    const opened = Math.max(furthest.length, (lesson.watched || []).length);
    const lengthSeconds = lessonLengthSeconds(lesson);
    const studentsByMinute = byMinute.map(({ minute }) => ({
      minute,
      back: 0,
      skip: 0,
      pause: 0,
      reached: furthest.filter((f) => f.max >= minute * 60).length,
    }));
    const key = { backward_seek: "back", forward_seek: "skip", pause: "pause" };
    studentMinuteRaw.forEach(({ _id, students }) => {
      const row = studentsByMinute[Math.max(0, Math.floor(_id.minute))];
      if (row) row[key[_id.action]] = students;
    });

    return res.json({
      success: true,
      summary,
      students: {
        opened,
        jumped_back: backStudents.length,
        skipped: skipStudents.length,
        paused: pauseStudents.length,
        reached_end: lengthSeconds ? furthest.filter((f) => f.max >= lengthSeconds * 0.95).length : null,
      },
      students_by_minute: studentsByMinute,
      by_minute: byMinute,
      hotspots: {
        most_paused: topN("pause"),
        most_replayed: topN("backward_seek"),
        most_skipped: topN("forward_seek"),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  logInteraction,
  getClickstream,
};
