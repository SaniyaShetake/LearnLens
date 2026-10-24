const Feedback = require("../database/models/feedback");
const Lesson = require("../database/models/lesson");
const Course = require("../database/models/course");
const UniqueId = require("../database/models/unique-id");
const Student = require("../database/models/student");
const ExcelJS = require("exceljs");
const { feedbackTypes } = require("../data/data");
const { createSheetNamer, handleExportError } = require("../utils/excel");

const FEEDBACK_KINDS = ["difficult", "easy", "boring", "engaging"];
const MAX_OTHER_MESSAGE_LENGTH = 1000;

const toValidDate = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const { getClientIp, setUUIDCookie, isValidObjectId, sendError } = require("../handlers/misc");

// Lessons created before this date ignore the minimum-feedback threshold (legacy behaviour).
const THRESHOLD_CHANGE_DATE = new Date("2021-10-13T20:15:59.753+00:00");
// Same semantics as date-fns isBefore: false for missing/invalid dates.
const isBeforeThresholdChange = (date) => new Date(date).getTime() < THRESHOLD_CHANGE_DATE.getTime();

/**
 * Difficult
 * lack of explaination
 * new concept for me
 * too difficult to understand
 * issue with slide / blackboard writing
 * no exposure to real-life examples
 * too fast
 *
 *
 * Easy
 * good explaination
 * enough background to understand the topic / concept
 * easy to understand
 * well prepared presentation
 * good presentation style
 *
 *
 * Boring
 * not explained properly
 * too challenging / difficult content
 * too easy content
 * content not meaningful to me
 * I am bored in general
 * presentation style of the teacher
 * too much repetition
 * too slow
 *
 *
 * Engaging
 * good explaination
 * practical applications are discussed
 * i have some idea about the topic / concept
 * counter - intuitive examples / explaination
 * presentation style of the teacher
 */

const generateStudentMinuteData = (studentSecondData, lectureLength = 0, { min, max }, seconds = 0, lessonCreatedAt) => {
  if (Array.isArray(studentSecondData)) {
    const ignoreThreshold = isBeforeThresholdChange(lessonCreatedAt);
    const minThreshold = Math.floor((lectureLength * 60) / 120);
    const maxThreshold = (seconds || lectureLength * 60) - minThreshold;
    return studentSecondData.map((student) => {
      // Default data for studentFeedback per minute
      const studentMinuteDataDefault = Array.from({
        length: lectureLength,
      }).map((_, i) => {
        // Array runs `lectureLength` times, and i starts from 0 and ends at lectureLength - 1
        // We set default values which is false for every iteration
        return {
          minute: i + 1,
          easy: false,
          difficult: false,
          engaging: false,
          boring: false,
          student: student.student,
          others: {
            easy: [],
            difficult: [],
            engaging: [],
            boring: [],
          },
        };
      });

      if (Array.isArray(student.feedback)) {
        let studentFeedbacks = student.feedback;

        if (!ignoreThreshold) {
          studentFeedbacks = studentFeedbacks.filter((feedback) => {
            return (
              feedback.seconds &&
              feedback.seconds >= minThreshold &&
              feedback.seconds <= maxThreshold
            );
          });
        }

        studentFeedbacks.forEach((feedback) => {
          const { seconds } = feedback;
          // We round off seconds to minutes
          const minute = Math.ceil(seconds / 60);
          // Since this feedback array only contains fields where boolean fields are true
          // We directly rewrite
          if (
            minute >= 1 &&
            minute <= lectureLength &&
            !!studentMinuteDataDefault[minute - 1]
          ) {
            let value = {
              details: {},
              ...studentMinuteDataDefault[minute - 1],
            };

            value.easy = feedback.easy || value.easy;
            value.difficult = feedback.difficult || value.difficult;
            value.engaging = feedback.engaging || value.engaging;
            value.boring = feedback.boring || value.boring;
            value.seconds = feedback.seconds;

            const feedbackDetails = { ...feedback.details };
            Object.keys(feedbackDetails).forEach((key) =>
              feedbackDetails[key] === undefined
                ? delete feedbackDetails[key]
                : {}
            );

            value.details = { ...value.details, ...feedbackDetails };

            if (feedback.easy) {
              value.others.easy.push(feedback.details.other);
            }
            if (feedback.difficult) {
              value.others.difficult.push(feedback.details.other);
            }
            if (feedback.engaging) {
              value.others.engaging.push(feedback.details.other);
            }
            if (feedback.boring) {
              value.others.boring.push(feedback.details.other);
            }

            studentMinuteDataDefault[minute - 1] = value;
          }
        });
      }

      // Return mapped output which has `lectureLength` entries in minute data
      return studentMinuteDataDefault.filter((s) => {
        return s.minute >= min + 1 && s.minute <= max;
      });
    });
  }
};

const generateClassFeedback = (studentMinuteFeedback, lectureLength = 0, { min, max }) => {
  if (Array.isArray(studentMinuteFeedback)) {
    const consolidatedData = Array.from({ length: lectureLength })
      .map((_, i) => {
        return {
          minute: i + 1,
          easy: 0,
          difficult: 0,
          engaging: 0,
          boring: 0,
          unique: {},
        };
      })
      .filter((s) => {
        return s.minute >= min + 1 && s.minute <= max;
      });
    // TODO: Remove filtering & create a generator method for consolidated Empty array
    studentMinuteFeedback.forEach((minute) => {
      if (Array.isArray(minute)) {
        minute.forEach((feedback, i) => {
          if ((feedback.easy || feedback.difficult || feedback.engaging || feedback.boring) && !consolidatedData[i].unique[feedback.student]) {
            consolidatedData[i].unique[feedback.student] = {
              easy_details: [],
              difficult_details: [],
              engaging_details: [],
              boring_details: [],
              easy_others: [],
              difficult_others: [],
              engaging_others: [],
              boring_others: [],
            };
          }
          if (feedback.easy) {
            // if (!consolidatedData[i].unique[feedback.student]) {
            //   consolidatedData[i].unique[feedback.student] = { easy: 0 };
            // }
            consolidatedData[i].easy += 1;
            consolidatedData[i].unique[feedback.student].easy = (consolidatedData[i].unique[feedback.student].easy || 0) + 1;

            consolidatedData[i].unique[feedback.student].easy_details.push(feedback.details.easy || (feedback.details.none && "none"));
            consolidatedData[i].unique[feedback.student].easy_others.push(...feedback.others.easy);
          }
          if (feedback.difficult) {
            // if (!consolidatedData[i].unique[feedback.student]) {
            //   consolidatedData[i].unique[feedback.student] = { difficult: 0 };
            // }
            consolidatedData[i].difficult += 1;
            consolidatedData[i].unique[feedback.student].difficult = (consolidatedData[i].unique[feedback.student].difficult || 0) + 1;
            // consolidatedData[i].unique.difficult[feedback.student] = (consolidatedData[i].unique.difficult[feedback.student] || 0) + 1;
            consolidatedData[i].unique[feedback.student].difficult_details.push(feedback.details.difficult || (feedback.details.none && "none"));
            consolidatedData[i].unique[feedback.student].difficult_others.push(...feedback.others.difficult);
          }
          if (feedback.engaging) {
            // if (!consolidatedData[i].unique[feedback.student]) {
            //   consolidatedData[i].unique[feedback.student] = { engaging: 0 };
            // }
            consolidatedData[i].engaging += 1;
            consolidatedData[i].unique[feedback.student].engaging = (consolidatedData[i].unique[feedback.student].engaging || 0) + 1;
            // consolidatedData[i].unique.engaging[feedback.student] = (consolidatedData[i].unique.engaging[feedback.student] || 0) + 1;
            consolidatedData[i].unique[feedback.student].engaging_details.push(feedback.details.engaging || (feedback.details.none && "none"));
            consolidatedData[i].unique[feedback.student].engaging_others.push(...feedback.others.engaging);
          }
          if (feedback.boring) {
            consolidatedData[i].boring += 1;
            consolidatedData[i].unique[feedback.student].boring = (consolidatedData[i].unique[feedback.student].boring || 0) + 1;
            // consolidatedData[i].unique.boring[feedback.student] = (consolidatedData[i].unique.boring[feedback.student] || 0) + 1;
            consolidatedData[i].unique[feedback.student].boring_details.push(feedback.details.boring || (feedback.details.none && "none"));
            consolidatedData[i].unique[feedback.student].boring_others.push(...feedback.others.boring);
          }
        });
      }
    });
    return consolidatedData;
  }
};

const generateMovingWindowAnalysis = (classFeedback = []) => {
  if (Array.isArray(classFeedback)) {
    const movingWindowFeedback = [];
    for (let i = 0; i < classFeedback.length; i++) {
      var feedback = { ...classFeedback[i] };
      if (i < classFeedback.length - 1) {
        var feedbackNext = classFeedback[i + 1];
        feedback.easy = Math.round((feedbackNext.easy + feedback.easy) / 2);
        feedback.difficult = Math.round((feedbackNext.difficult + feedback.difficult) / 2);
        feedback.engaging = Math.round((feedbackNext.engaging + feedback.engaging) / 2);
        feedback.boring = Math.round((feedbackNext.boring + feedback.boring) / 2);
      }
      feedback.net_engagement = feedback.engaging - feedback.boring;
      feedback.net_difficult = feedback.difficult - feedback.easy;
      movingWindowFeedback.push(feedback);
    }
    return movingWindowFeedback;
  }
};

const generatePercentageFeedback = (movingWindowFeedback = []) => {
  if (Array.isArray(movingWindowFeedback)) {
    return movingWindowFeedback.map((feedback) => {
      const { easy, difficult, engaging, boring, minute } = feedback;
      const totalFeedbacksBy100 = movingWindowFeedback.length * 0.01;
      return {
        minute,
        easy: easy / totalFeedbacksBy100,
        difficult: difficult / totalFeedbacksBy100,
        engaging: engaging / totalFeedbacksBy100,
        boring: boring / totalFeedbacksBy100,
      };
    });
  }
};

const generateNetDistribution = (movingWindowFeedback = []) => {
  if (Array.isArray(movingWindowFeedback)) {
    return movingWindowFeedback.map((feedback) => {
      const { easy = 0, difficult = 0, engaging = 0, boring = 0, minute } = feedback;
      return {
        minute,
        net_engagement: engaging - boring,
        net_difficult: difficult - easy,
      };
    });
  }
};

const generateClickDistribution = (classFeedback = []) => {
  if (Array.isArray(classFeedback)) {
    let sum_easy = 0,
      sum_difficult = 0,
      sum_engaging = 0,
      sum_boring = 0;
    let idf = 0;
    while (idf < classFeedback.length) {
      const { easy, difficult, engaging, boring } = classFeedback[idf];
      sum_easy += easy ? easy : 0;
      sum_difficult += difficult ? difficult : 0;
      sum_engaging += engaging ? engaging : 0;
      sum_boring += boring ? boring : 0;
      idf += 1;
    }
    const total_easy_difficult = sum_easy + sum_difficult;
    const total_engaging_boring = sum_engaging + sum_boring;
    const percentage_easy = sum_easy / total_easy_difficult;
    const percentage_difficult = sum_difficult / total_easy_difficult;
    const percentage_engaging = sum_engaging / total_engaging_boring;
    const percentage_boring = sum_boring / total_engaging_boring;
    return {
      sum_easy,
      sum_difficult,
      sum_engaging,
      sum_boring,
      total_easy_difficult,
      total_engaging_boring,
      percentage_easy,
      percentage_difficult,
      percentage_engaging,
      percentage_boring,
    };
  }
};

const generateOverlappingData = (studentMinuteData) => {
  if (Array.isArray(studentMinuteData)) {
    const result = {
      difficult: 0,
      easy: 0,
      boring: 0,
      engaging: 0,
      difficult_easy: 0,
      difficult_boring: 0,
      difficult_engaging: 0,
      boring_engaging: 0,
      boring_easy: 0,
      engaging_easy: 0,
    };
    let idm = 0;
    while (idm < studentMinuteData.length) {
      const studentData = studentMinuteData[idm];
      if (Array.isArray(studentData)) {
        let ids = 0;
        while (ids < studentData.length) {
          const { difficult, easy, boring, engaging } = studentData[ids];
          result.difficult += difficult ? 1 : 0;
          result.easy += easy ? 1 : 0;
          result.boring += boring ? 1 : 0;
          result.engaging += engaging ? 1 : 0;
          result.difficult_easy += difficult && easy ? 1 : 0;
          result.difficult_boring += difficult && boring ? 1 : 0;
          result.difficult_engaging += difficult && engaging ? 1 : 0;
          result.boring_engaging += boring && engaging ? 1 : 0;
          result.boring_easy += boring && easy ? 1 : 0;
          result.engaging_easy += engaging && easy ? 1 : 0;
          ids += 1;
        }
      }
      idm += 1;
    }

    return result;
  }
};

const generateVennFeedback = (classFeedback) => {
  const easySet = new Set();
  const boringSet = new Set();
  const difficultSet = new Set();
  const engagingSet = new Set();
  const difficult_easySet = new Set();
  const difficult_boringSet = new Set();
  const difficult_engagingSet = new Set();
  const boring_easySet = new Set();
  const boring_engagingSet = new Set();
  const engaging_easySet = new Set();

  const feedbackUserIdSet = new Set();

  const vennData = {
    easy: 0,
    boring: 0,
    difficult: 0,
    engaging: 0,
    difficult_easy: 0,
    difficult_boring: 0,
    difficult_engaging: 0,
    boring_engaging: 0,
    boring_easy: 0,
    engaging_easy: 0,
  };

  const vennD = {
    easy: 0,
    boring: 0,
    difficult: 0,
    engaging: 0,
    difficult_easy: 0,
    difficult_boring: 0,
    difficult_engaging: 0,
    boring_easy: 0,
    boring_engaging: 0,
    engaging_easy: 0,
  };

  const feedbackTypes = {
    easy: [],
    boring: [],
    difficult: [],
    engaging: [],
    others: {
      easy: [],
      boring: [],
      difficult: [],
      engaging: [],
    },
  };

  // Every reason picked, with who picked it and in which minute (for student counts per reason)
  const reasonEntries = { easy: [], boring: [], difficult: [], engaging: [] };
  const addReasons = (kind, details, userId, minute) =>
    details.filter((f) => f != null).forEach((key) => reasonEntries[kind].push({ key, userId, minute }));

  const userAggregate = {};

  if (Array.isArray(classFeedback)) {
    classFeedback.forEach((minute) => {
      const users = Object.keys(minute.unique);

      users.forEach((userId) => {
        if (!userAggregate[userId]) {
          userAggregate[userId] = {
            easy: 0,
            difficult: 0,
            engaging: 0,
            boring: 0,
          };
        }

        const minute_user_feedback = minute.unique[userId];
        if (minute_user_feedback.easy) {
          userAggregate[userId].easy += minute_user_feedback.easy;
        }
        if (minute_user_feedback.boring) {
          userAggregate[userId].boring += minute_user_feedback.boring;
        }
        if (minute_user_feedback.difficult) {
          userAggregate[userId].difficult += minute_user_feedback.difficult;
        }
        if (minute_user_feedback.engaging) {
          userAggregate[userId].engaging += minute_user_feedback.engaging;
        }
      });
    });

    Object.keys(userAggregate).forEach((userId) => {
      const data = userAggregate[userId];

      if (data.difficult > 0) {
        vennD.difficult += 1;
        if (data.easy > 0) {
          vennD.difficult_easy += 1;
        }
        if (data.engaging > 0) {
          vennD.difficult_engaging += 1;
        }
        if (data.boring > 0) {
          vennD.difficult_boring += 1;
        }
      }
      if (data.boring > 0) {
        vennD.boring += 1;
        if (data.engaging > 0) {
          vennD.boring_engaging += 1;
        }
        if (data.easy > 0) {
          vennD.boring_easy += 1;
        }
      }
      if (data.engaging > 0) {
        vennD.engaging += 1;
        if (data.easy > 0) {
          vennD.engaging_easy += 1;
        }
      }
      if (data.easy > 0) {
        vennD.easy += 1;
      }
    });

    classFeedback.forEach((minute) => {
      if (minute.unique) {
        const users = Object.keys(minute.unique);

        users.forEach((userId) => {
          feedbackUserIdSet.add(userId);
          const minute_user_feedback = minute.unique[userId];
          if (minute_user_feedback.easy) {
            vennData.easy += minute_user_feedback.easy;
            feedbackTypes.easy.push(...minute_user_feedback.easy_details.filter((f) => f != null));
            addReasons("easy", minute_user_feedback.easy_details, userId, minute.minute);
            feedbackTypes.others.easy.push(...minute_user_feedback.easy_others);
            easySet.add(userId); // TODO: Check this
          }
          if (minute_user_feedback.boring) {
            vennData.boring += minute_user_feedback.boring;
            feedbackTypes.boring.push(...minute_user_feedback.boring_details.filter((f) => f != null));
            addReasons("boring", minute_user_feedback.boring_details, userId, minute.minute);
            feedbackTypes.others.boring.push(...minute_user_feedback.boring_others);
            if (minute_user_feedback.easy) {
              vennData.boring_easy += Math.max(minute_user_feedback.boring, minute_user_feedback.easy) || 0;
              boring_easySet.add(userId);
            }
            if (minute_user_feedback.engaging) {
              vennData.boring_engaging += Math.max(minute_user_feedback.boring, minute_user_feedback.engaging) || 0;
              boring_engagingSet.add(userId);
            }
            boringSet.add(userId);
          }
          if (minute_user_feedback.difficult) {
            vennData.difficult += minute_user_feedback.difficult;
            feedbackTypes.difficult.push(...minute_user_feedback.difficult_details.filter((f) => f != null));
            addReasons("difficult", minute_user_feedback.difficult_details, userId, minute.minute);
            feedbackTypes.others.difficult.push(...minute_user_feedback.difficult_others);
            if (minute_user_feedback.easy) {
              vennData.difficult_easy += Math.max(minute_user_feedback.difficult, minute_user_feedback.easy) || 0;
              difficult_easySet.add(userId);
            }
            if (minute_user_feedback.boring) {
              vennData.difficult_boring += Math.max(minute_user_feedback.difficult, minute_user_feedback.boring) || 0;
              difficult_boringSet.add(userId);
            }
            if (minute_user_feedback.engaging) {
              vennData.difficult_engaging += Math.max(minute_user_feedback.difficult, minute_user_feedback.engaging) || 0;
              difficult_engagingSet.add(userId);
            }
            difficultSet.add(userId);
          }
          if (minute_user_feedback.engaging) {
            vennData.engaging += minute_user_feedback.engaging;
            feedbackTypes.engaging.push(...minute_user_feedback.engaging_details.filter((f) => f != null));
            addReasons("engaging", minute_user_feedback.engaging_details, userId, minute.minute);
            feedbackTypes.others.engaging.push(...minute_user_feedback.engaging_others);
            if (minute_user_feedback.easy) {
              vennData.engaging_easy += Math.max(minute_user_feedback.engaging, minute_user_feedback.easy) || 0;
              engaging_easySet.add(userId);
            }
            engagingSet.add(userId);
          }
        });
      }
    });
  }

  // Per reason: clicks (`value`, `percentage`: block size, unchanged), distinct `students`, and the
  // `minutes` it was picked in with distinct students per minute ([{ minute, students }]).
  // The top three reasons are kept; the rest are merged into one `others` entry.
  const sortAndCount = (entries = []) => {
    const groups = {};
    entries.forEach(({ key, userId, minute }) => {
      if (!groups[key]) groups[key] = { key, value: 0, users: new Set(), minutes: {} };
      const group = groups[key];
      group.value += 1;
      group.users.add(userId);
      if (!group.minutes[minute]) group.minutes[minute] = new Set();
      group.minutes[minute].add(userId);
    });
    const total = entries.length;
    const minuteList = (minutes) =>
      Object.keys(minutes)
        .map(Number)
        .sort((a, b) => a - b)
        .map((minute) => ({ minute, students: minutes[minute].size }));

    const sorted = Object.values(groups).sort((a, b) => b.value - a.value);
    const toResult = (g) => ({
      key: g.key,
      value: g.value,
      percentage: Math.round((g.value * 10000) / total) / 100,
      students: g.users.size,
      minutes: minuteList(g.minutes),
    });

    const result1 = sorted.slice(0, 3).map(toResult);
    const rest = sorted.slice(3);

    const restUsers = new Set();
    const restMinutes = {};
    rest.forEach((g) => {
      g.users.forEach((u) => restUsers.add(u));
      Object.entries(g.minutes).forEach(([m, users]) => {
        if (!restMinutes[m]) restMinutes[m] = new Set();
        users.forEach((u) => restMinutes[m].add(u));
      });
    });
    const restValues = rest.map(toResult);
    result1.push({
      others: true,
      percentage: restValues.reduce((sum, v) => sum + v.percentage, 0),
      values: restValues,
      students: restUsers.size,
      minutes: minuteList(restMinutes),
    });

    return result1;
  };
  return {
    venn: vennD,
    radial: vennData,
    participation: {
      easy: Array.from(easySet),
      boring: Array.from(boringSet),
      difficult: Array.from(difficultSet),
      engaging: Array.from(engagingSet),
    },
    unique: {
      users: feedbackUserIdSet.size,
      easy: easySet.size,
      boring: boringSet.size,
      difficult: difficultSet.size,
      engaging: engagingSet.size,
      difficult_easy: difficult_easySet.size,
      difficult_boring: difficult_boringSet.size,
      difficult_engaging: difficult_engagingSet.size,
      boring_easy: boring_easySet.size,
      boring_engaging: boring_engagingSet.size,
      engaging_easy: engaging_easySet.size,
    },

    detailed: {
      easy: sortAndCount(reasonEntries.easy),
      boring: sortAndCount(reasonEntries.boring),
      difficult: sortAndCount(reasonEntries.difficult),
      engaging: sortAndCount(reasonEntries.engaging),
      others: feedbackTypes.others,
    },
  };
};

const watchedVideo = async (req, res) => {
  try {
    const { id } = req.params;
    setUUIDCookie(req, res);

    const student_id = req.user._id;

    const query = {};
    if (isValidObjectId(id)) query._id = id;
    else query.id = id;

    const lesson = await Lesson.findOneAndUpdate(query, { $addToSet: { watched: student_id } }, { new: true });

    if (lesson) {
      return res.send({
        success: true,
      });
    }

    return res.send({
      success: false,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

// Upper bound for feedback timestamps when the lesson's duration is unknown
const MAX_TIMESTAMP_SECONDS = 24 * 60 * 60;

/** Lesson duration in seconds (from `seconds`, else `minutes`), or null when unknown. */
const lessonDurationSeconds = (lesson) => {
  if (lesson && Number.isFinite(lesson.seconds) && lesson.seconds > 0) return lesson.seconds;
  if (lesson && Number.isFinite(lesson.minutes) && lesson.minutes > 0) return lesson.minutes * 60;
  return null;
};

/** Clamps a (finite) video timestamp to [0, lesson duration] (or [0, 24h] if the duration is unknown). */
const clampTimestamp = (seconds, lesson) => {
  const max = lessonDurationSeconds(lesson) || MAX_TIMESTAMP_SECONDS;
  return Math.min(Math.max(seconds, 0), max);
};

const recordFeedback = async (req, res) => {
  try {
    const { timestamp, feedback, feedback_type, other_message = "", date_client } = req.body;
    const { id } = req.params;

    // Only allow known feedback kinds as keys (prevents mass-assignment of arbitrary fields)
    if (typeof feedback !== "string" || !FEEDBACK_KINDS.includes(feedback)) {
      return res.status(400).send({
        success: false,
        message: "Invalid feedback",
      });
    }

    // A missing timestamp is accepted (stored without `seconds`, like before) so clicks aren't lost;
    // anything provided must be a finite number and is clamped to the lesson's length below.
    const hasTimestamp = !(timestamp === undefined || timestamp === null || timestamp === "");
    const rawSeconds = hasTimestamp ? Number(timestamp) : undefined;
    if (hasTimestamp && (typeof timestamp === "boolean" || typeof timestamp === "object" || !Number.isFinite(rawSeconds))) {
      return res.status(400).send({
        success: false,
        message: "Invalid timestamp",
      });
    }

    const isNone = typeof feedback_type === "undefined" || feedback_type === null || feedback_type === "";
    const isOther = feedback_type === "other";
    if (!isNone && !isOther && !(typeof feedback_type === "string" && Object.prototype.hasOwnProperty.call(feedbackTypes[feedback], feedback_type))) {
      return res.status(400).send({
        success: false,
        message: "Invalid feedback type",
      });
    }

    const student_id = req.user._id;
    const student = await Student.findOne({ _id: student_id });

    if (!student) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized",
      });
    }

    const query = {};
    if (isValidObjectId(id)) query._id = id;
    else query.id = id;

    const lesson = await Lesson.findOneAndUpdate(query, { $addToSet: { watched: student._id } }, { new: true });

    if (!lesson) {
      return res.send({
        success: false,
        message: "Not recorded",
      });
    }

    const newFeedback = new Feedback({
      seconds: hasTimestamp ? clampTimestamp(rawSeconds, lesson) : undefined,
      [feedback]: true,
      lesson: lesson._id,
      ip: getClientIp(req),
      date_client: toValidDate(date_client),
      student_id,
    });

    if (isNone) {
      newFeedback.details.none = true;
    } else if (isOther) {
      newFeedback.details.other = String(other_message || "").slice(0, MAX_OTHER_MESSAGE_LENGTH);
    } else {
      newFeedback.details[feedback] = feedback_type;
    }

    await newFeedback.save();

    // Auto-enroll the student in the course so they can access it from the student dashboard.
    if (lesson.course) {
      await Course.updateOne(
        { _id: lesson.course, students: { $ne: student._id } },
        { $addToSet: { students: student._id } }
      );
    }

    return res.send({
      success: true,
      message: "Recorded",
      newFeedback,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const studentColumns = [
  { header: "Timestamp (seconds)", key: "seconds", width: 10 },
  { header: "Difficult", key: "difficult", width: 10 },
  { header: "Easy", key: "easy", width: 10 },
  { header: "Boring", key: "boring", width: 10 },
  { header: "Engaging", key: "engaging", width: 10 },
  { header: "Student Unique ID", key: "student", width: 32 },
  { header: "Student Name", key: "student_name", width: 40 },
  // Add details
];

const classFeedbackColumns = [
  { header: "Timestamp (minutes)", key: "minute", width: 10 },
  { header: "Difficult", key: "difficult", width: 10 },
  { header: "Easy", key: "easy", width: 10 },
  { header: "Boring", key: "boring", width: 10 },
  { header: "Engaging", key: "engaging", width: 10 },
  // Add details
];

const RESERVED_SHEET_NAMES = ["CLASS FEEDBACK", "NO FEEDBACK STUDENTS"];

const noFeedbackStudentsColumns = [
  { header: "Unique ID", key: "uuid", width: 32 },
  { header: "Name", key: "name", width: 40 },
  { header: "Date", key: "createdAt" },
];

/**
 * Batch-loads display info (name, createdAt) for a list of student identifiers, which are
 * either Student ObjectIds or legacy UniqueId uuids. Returns a Map keyed by the identifier string.
 */
const loadStudentInfo = async (identifiers = []) => {
  const ids = Array.from(new Set(identifiers.map((i) => String(i))));
  const objectIds = ids.filter((i) => isValidObjectId(i));
  const uuids = ids.filter((i) => !isValidObjectId(i));

  const [students, uniqueIds] = await Promise.all([
    objectIds.length ? Student.find({ _id: { $in: objectIds } }).select("_id name createdAt").lean() : [],
    uuids.length ? UniqueId.find({ uuid: { $in: uuids } }).select("uuid name createdAt").lean() : [],
  ]);

  const info = new Map();
  students.forEach((st) => info.set(String(st._id), st));
  uniqueIds.forEach((u) => {
    if (!info.has(u.uuid)) info.set(u.uuid, u);
  });
  return info;
};

const safeFilenamePart = (value = "") =>
  String(value)
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, 100) || "lesson";

const exportFeedbackForLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const query = isValidObjectId(id) ? { _id: id } : { id };

    // Excel
    const workbook = new ExcelJS.Workbook();

    const lesson = await Lesson.findOne(query);

    if (lesson) {
      const lectureLength = lesson.seconds ? lesson.seconds : Math.ceil(lesson.minutes * 60);
      const minThreshold = Math.floor(lectureLength / 120);
      const maxThreshold = lectureLength - minThreshold;

      const ignoreThreshold = isBeforeThresholdChange(lesson.createdAt);

      const feedbacks = await Feedback.find({ lesson: lesson._id }).sort("seconds").exec();
      const studentWiseObject = {};
      const studentArray = [];

      let fI = 0;
      while (fI < feedbacks.length) {
        const feedback = feedbacks[fI];

        if (feedback) {
          const unique_id = feedback.student_id || feedback.unique_id;
          if (!studentWiseObject[unique_id]) studentWiseObject[unique_id] = [];

          if (ignoreThreshold || (feedback.seconds && feedback.seconds >= minThreshold && feedback.seconds <= maxThreshold)) {
            studentWiseObject[unique_id].push(feedback);
          }
        }

        fI += 1;
      }

      const studentKeys = Object.keys(studentWiseObject);

      let skI = 0;
      while (skI < studentKeys.length) {
        const student_id = studentKeys[skI];

        studentArray.push({
          student: student_id,
          feedback: studentWiseObject[student_id],
        });

        skI += 1;
      }

      const lessonLength = lesson.minutes || Math.ceil(lesson.seconds / 60);
      const noRange = { min: 0, max: lessonLength };

      const studentMinuteData = generateStudentMinuteData(studentArray, lessonLength, noRange, lesson.seconds, lesson.createdAt);
      const classFeedback = generateClassFeedback(studentMinuteData, lessonLength, noRange, lesson.seconds);

      const watched = (lesson.watched || []).map((w) => String(w));
      const providedFeedback = new Set(studentArray.map((s) => String(s.student)));
      const noFeedbackStudentsArray = watched.filter((s) => !providedFeedback.has(s));

      // One query per collection instead of one per student
      const studentInfo = await loadStudentInfo([...providedFeedback, ...noFeedbackStudentsArray]);

      const nextSheetName = createSheetNamer(RESERVED_SHEET_NAMES);
      let idS = 0;
      while (idS < studentArray.length) {
        const secondData = studentArray[idS];

        const uid = studentInfo.get(String(secondData.student));
        const studentName = uid && typeof uid.name === "string" ? uid.name.trim() : "";

        // Excel sheet names: max 31 chars, unique (case-insensitive), must not clash with the summary sheets
        const worksheetName = nextSheetName(studentName.toUpperCase(), "Student " + (idS + 1));

        const worksheet = workbook.addWorksheet(worksheetName);

        worksheet.columns = studentColumns;

        if (Array.isArray(secondData.feedback)) {
          let idSF = 0;
          while (idSF < secondData.feedback.length) {
            const feedback = secondData.feedback[idSF];

            const r = {
              seconds: feedback.seconds || 0,
              difficult: feedback.difficult ? 1 : 0,
              easy: feedback.easy ? 1 : 0,
              boring: feedback.boring ? 1 : 0,
              engaging: feedback.engaging ? 1 : 0,
            };

            if (idSF === 0) {
              r.student = secondData.student;
              r.student_name = studentName || worksheetName;
            }

            worksheet.addRow(r);

            idSF += 1;
          }
        }

        idS += 1;
      }

      const classFeedbackWorksheet = workbook.addWorksheet("CLASS FEEDBACK");
      classFeedbackWorksheet.columns = classFeedbackColumns;

      let idC = 0;
      while (idC < classFeedback.length) {
        const feedback = classFeedback[idC];

        classFeedbackWorksheet.addRow({
          minute: feedback.minute,
          difficult: feedback.difficult,
          easy: feedback.easy,
          boring: feedback.boring,
          engaging: feedback.engaging,
        });

        idC += 1;
      }

      const noFeedbackStudentsWorksheet = workbook.addWorksheet("NO FEEDBACK STUDENTS");
      noFeedbackStudentsWorksheet.columns = noFeedbackStudentsColumns;
      const rowsToAdd = [];

      let idNF = 0;
      while (idNF < noFeedbackStudentsArray.length) {
        const nfid = noFeedbackStudentsArray[idNF];

        const nfStudent = studentInfo.get(nfid);

        rowsToAdd.push({
          name: nfStudent ? nfStudent.name : null,
          uuid: nfid,
          createdAt: nfStudent ? nfStudent.createdAt : null,
        });

        idNF += 1;
      }

      rowsToAdd.sort((a, b) => {
        return b.createdAt - a.createdAt;
      });

      noFeedbackStudentsWorksheet.addRows(rowsToAdd.map((r) => ({ ...r, name: r.name || "Not found" })));

      // Stream the workbook directly; nothing is written to disk
      const filename = `lesson-${safeFilenamePart(lesson.id || id)}-feedback-export.xlsx`;
      res.status(200);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    return res.status(404).send({ success: false, message: "Lesson not found" });
  } catch (error) {
    return handleExportError(res, error);
  }
};

const getAllFeedbackForLesson = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      return res.status(401).send({ success: false, message: "Unauthorized" });
    }
    // Teacher dashboard: only the owner's lesson (also enforced by verifyResourceIsForUser on the route)
    const query = isValidObjectId(id) ? { _id: id, user: req.user._id } : { id, user: req.user._id };
    const lesson = await Lesson.findOne(query).populate("bookmarks current_bookmark").exec();
    if (lesson) {
      const feedbacks = await Feedback.find({ lesson: lesson._id }).sort({ createdAt: 1 }).exec();
      const studentWiseObject = {};
      // console.log(feedbacks);
      let fbI = 0;
      while (fbI < feedbacks.length) {
        var feedback = feedbacks[fbI];
        if (feedback) {
          var unique_id = feedback.student_id || feedback.unique_id;
          if (!studentWiseObject[unique_id]) studentWiseObject[unique_id] = [];
          studentWiseObject[unique_id].push(feedback);
        }
        fbI += 1;
      }
      const studentSecondArray = [];
      Object.keys(studentWiseObject).forEach((k) => {
        studentSecondArray.push({
          lesson: lesson._id,
          student: k,
          feedback: studentWiseObject[k],
        });
      });
      // writeFile("studentSecondArray.json", studentSecondArray);
      const lessonLength = lesson.minutes || Math.ceil(lesson.seconds / 60);

      const toInt = (value, fallback) => {
        const n = parseInt(value, 10);
        return Number.isFinite(n) ? n : fallback;
      };

      let min = 1;
      if (req.query.min) {
        min = toInt(req.query.min, 0);
      } else {
        if (lesson.current_bookmark) {
          min = toInt(lesson.current_bookmark.time_from, min);
        }
      }
      let max = lessonLength;
      if (req.query.max) {
        max = toInt(req.query.max, lessonLength);
      } else {
        if (lesson.current_bookmark) {
          max = toInt(lesson.current_bookmark.time_to, max);
        }
      }

      const noRange = { min: 0, max: lessonLength };

      const studentMinuteDataRanged = generateStudentMinuteData(studentSecondArray, lessonLength, { min, max }, lesson.seconds, lesson.createdAt);
      const studentMinuteData = generateStudentMinuteData(studentSecondArray, lessonLength, noRange, lesson.seconds, lesson.createdAt);
      // writeFile("studentMinuteData.json", studentMinuteData);

      const overlappingData = generateOverlappingData(studentMinuteDataRanged);
      // writeFile("overlappingData.json", overlappingData);

      const classFeedback = generateClassFeedback(studentMinuteData, lessonLength, noRange);
      const classFeedbackRanged = generateClassFeedback(studentMinuteDataRanged, lessonLength, { min, max });
      // writeFile("classFeedback.json", classFeedback);
      // console.log("classFeedback", classFeedback);

      const movingWindowFeedbackRanged = generateMovingWindowAnalysis(classFeedbackRanged);
      const movingWindowFeedback = generateMovingWindowAnalysis(classFeedback);
      // writeFile("movingWindowFeedback.json", movingWindowFeedback);
      // console.log("movingWindowFeedback classFeedback", classFeedback);

      const vennFeedback = generateVennFeedback(classFeedbackRanged);
      const vennFeedbackNotRanged = generateVennFeedback(classFeedback);
      // writeFile("vennFeedback.json", vennFeedback);

      const percentageFeedback = generatePercentageFeedback(movingWindowFeedbackRanged);
      // writeFile("percentageFeedback.json", percentageFeedback);
      // console.log("percentageFeedback classFeedback", classFeedback);

      const netDistribution = generateNetDistribution(movingWindowFeedbackRanged);
      // writeFile("netDistribution.json", netDistribution);
      // console.log("netDistribution classFeedback", classFeedback);

      const clickDistribution = generateClickDistribution(classFeedbackRanged);
      // writeFile("clickDistribution.json", clickDistribution);

      return res.send({
        success: true,
        lesson,
        feedback: {
          overlapping: overlappingData,
          net: netDistribution,
          click_distribution: clickDistribution,
          venn: vennFeedback.venn,
          participation: vennFeedback.participation,
          participation_all: vennFeedbackNotRanged.participation,
          unique: vennFeedback.unique,
          radial: vennFeedback.radial,
          detailed: vennFeedback.detailed,
          percentage: percentageFeedback,
          minute: movingWindowFeedback,
          class_feedback: classFeedback,
          students_count: new Set(Object.keys(studentWiseObject || {})).size,
        },
      });
    }
    return res.status(404).send({
      success: false,
      message: "Lesson not found",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  recordFeedback,
  getAllFeedbackForLesson,
  watchedVideo,
  exportFeedbackForLesson,
};
