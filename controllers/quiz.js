const QuizQuestion = require("../database/models/quiz-question");
const QuizAnswer   = require("../database/models/quiz-answer");
const Lesson = require("../database/models/lesson");
const { isValidObjectId, sendError } = require("../handlers/misc");

const findLesson = (id) =>
  isValidObjectId(id)
    ? Lesson.findOne({ _id: id })
    : Lesson.findOne({ id });

const findOwnedLesson = (id, userId) =>
  isValidObjectId(id)
    ? Lesson.findOne({ _id: id, user: userId })
    : Lesson.findOne({ id, user: userId });

const VALID_TYPES = ["mcq", "msq", "true_false"];
const MAX_QUESTION_LENGTH = 1000;
const MAX_OPTION_LENGTH = 500;
const MAX_OPTIONS = 10;

const notFound = (res, message) => res.status(404).send({ success: false, message });
const badRequest = (res, message) => res.status(400).send({ success: false, message });

/**
 * Validates a question (on create, or the stored question with the update merged in) and
 * normalizes its options. Same rules as the quiz manager form: mcq and true_false need exactly
 * one correct option, msq at least one. Returns { error } or { value }.
 */
const validateQuestionInput = ({ question, type, options, timestamp }, lesson) => {
  if (typeof question !== "string" || !question.trim()) return { error: "question is required." };
  if (question.length > MAX_QUESTION_LENGTH) return { error: `question must be at most ${MAX_QUESTION_LENGTH} characters.` };
  if (!VALID_TYPES.includes(type)) return { error: "Invalid type. Use mcq, msq or true_false." };

  // Number(null), Number("") and Number(true) are finite, so check the raw type as well
  const seconds = typeof timestamp === "number" || typeof timestamp === "string" ? Number(timestamp) : NaN;
  if (timestamp === "" || !Number.isFinite(seconds) || seconds < 0) return { error: "timestamp must be a number of seconds (0 or more)." };
  const lessonLength = lesson.seconds || (lesson.minutes || 0) * 60;
  if (lessonLength && seconds > lessonLength) return { error: "timestamp is past the end of the video." };

  if (!Array.isArray(options)) return { error: "options must be a list." };
  let finalOptions;
  if (type === "true_false") {
    finalOptions = [
      { text: "True",  isCorrect: !!(options[0] && options[0].isCorrect === true) },
      { text: "False", isCorrect: !!(options[1] && options[1].isCorrect === true) },
    ];
  } else {
    if (options.length < 2 || options.length > MAX_OPTIONS) return { error: `Provide between 2 and ${MAX_OPTIONS} options.` };
    const hasText = (o) => o && typeof o.text === "string" && o.text.trim() && o.text.length <= MAX_OPTION_LENGTH;
    if (!options.every(hasText)) return { error: `Every option needs text (at most ${MAX_OPTION_LENGTH} characters).` };
    finalOptions = options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect === true }));
  }

  const correctCount = finalOptions.filter((o) => o.isCorrect).length;
  if (type === "msq" && correctCount < 1) return { error: "Mark at least one correct option." };
  if (type !== "msq" && correctCount !== 1) return { error: "Mark exactly one correct option." };

  return { value: { question: question.trim(), type, options: finalOptions, timestamp: seconds } };
};

// ── Teacher: list questions ──────────────────────────────────────────────────

const getQuizQuestions = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const questions = await QuizQuestion.find({ lesson: lesson._id }).sort({ timestamp: 1 });
    return res.json({ success: true, questions });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: create question ─────────────────────────────────────────────────

const createQuizQuestion = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const { error, value } = validateQuestionInput(req.body, lesson);
    if (error) return badRequest(res, error);

    const newQ = await new QuizQuestion({
      lesson: lesson._id,
      ...value,
      created_by: req.user._id,
    }).save();

    return res.status(201).json({ success: true, question: newQ });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: update question ─────────────────────────────────────────────────

const updateQuizQuestion = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    if (!isValidObjectId(req.params.qid)) return notFound(res, "Question not found.");
    const existing = await QuizQuestion.findOne({ _id: req.params.qid, lesson: lesson._id });
    if (!existing) return notFound(res, "Question not found.");

    // Fields left out of the request keep their stored value; the result is validated as a whole
    const fields = ["question", "type", "options", "timestamp"];
    const merged = {};
    fields.forEach((f) => (merged[f] = req.body[f] !== undefined ? req.body[f] : existing[f]));
    const { error, value } = validateQuestionInput(merged, lesson);
    if (error) return badRequest(res, error);

    // Normalizing rebuilds the options (new _ids), so only replace them when options or type changed
    const { options, ...rest } = value;
    existing.set(req.body.options !== undefined || req.body.type !== undefined ? value : rest);
    await existing.save();
    return res.json({ success: true, question: existing });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: delete question ─────────────────────────────────────────────────

const deleteQuizQuestion = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    if (!isValidObjectId(req.params.qid)) return notFound(res, "Question not found.");
    const deleted = await QuizQuestion.findOneAndDelete({ _id: req.params.qid, lesson: lesson._id });
    if (!deleted) return res.status(404).send({ success: false, message: "Question not found." });

    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Student: list questions (no isCorrect) ───────────────────────────────────

const getStudentQuizQuestions = async (req, res) => {
  try {
    const lesson = await findLesson(req.params.lesson_id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const questions = await QuizQuestion.find({ lesson: lesson._id })
      .sort({ timestamp: 1 })
      .lean();

    // Strip isCorrect so students can't cheat by reading the API response
    const safe = questions.map((q) => ({
      ...q,
      options: q.options.map(({ _id, text }) => ({ _id, text })),
    }));

    return res.json({ success: true, questions: safe });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Student: submit answer ───────────────────────────────────────────────────

const submitQuizAnswer = async (req, res) => {
  try {
    const { qid } = req.params;
    if (!isValidObjectId(qid)) return notFound(res, "Question not found.");
    const question = await QuizQuestion.findById(qid);
    if (!question) return notFound(res, "Question not found.");
    // Deleting a lesson leaves its questions behind; they must not be answerable
    if (!(await Lesson.exists({ _id: question.lesson }))) return notFound(res, "Question not found.");

    // Single option _id (mcq/tf) or a non-empty array of option _ids (msq), all from this question
    const { answer } = req.body;
    const optionIds = question.options.map((o) => String(o._id));
    const isOptionId = (a) => typeof a === "string" && optionIds.includes(a);
    let correct = false;

    if (question.type === "msq") {
      if (!Array.isArray(answer) || !answer.length || !answer.every(isOptionId)) return badRequest(res, "Invalid answer.");
      const selected = [...new Set(answer)];
      const correctIds = question.options.filter((o) => o.isCorrect).map((o) => String(o._id));
      correct = correctIds.length === selected.length && correctIds.every((id) => selected.includes(id));
    } else {
      if (!isOptionId(answer)) return badRequest(res, "Invalid answer.");
      correct = question.options.id(answer).isCorrect === true;
    }

    // Save the answer for analytics
    await QuizAnswer.create({
      question: question._id,
      lesson:   question.lesson,
      student:  req.user._id,
      correct,
    });

    return res.json({ success: true, correct });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: quiz analysis ────────────────────────────────────────────────────

const getQuizAnalysis = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const questions = await QuizQuestion.find({ lesson: lesson._id }).sort({ timestamp: 1 }).lean();
    if (!questions.length) return res.json({ success: true, scoring: "first_try", questions: [], summary: { total_questions: 0, total_students: 0, opened: (lesson.watched || []).length, total_attempts: 0, correct: 0, wrong: 0 } });

    const qIds = questions.map((q) => q._id);

    const answers = await QuizAnswer.aggregate([
      { $match: { question: { $in: qIds } } },
      { $group: { _id: { question: "$question", correct: "$correct" }, count: { $sum: 1 } } },
    ]);

    const statsMap = {};
    for (const row of answers) {
      const key = String(row._id.question);
      if (!statsMap[key]) statsMap[key] = { correct: 0, wrong: 0 };
      if (row._id.correct) statsMap[key].correct += row.count;
      else statsMap[key].wrong += row.count;
    }

    // Per student and question: was the earliest answer correct, and was any answer correct?
    // Retries create extra QuizAnswer documents, so these student-level numbers are the honest ones.
    const perStudent = await QuizAnswer.aggregate([
      { $match: { question: { $in: qIds } } },
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: { question: "$question", student: "$student" },
          first: { $first: "$correct" },
          any: { $max: "$correct" },
        },
      },
      {
        $group: {
          _id: "$_id.question",
          answered: { $sum: 1 },
          first_correct: { $sum: { $cond: ["$first", 1, 0] } },
          best_correct: { $sum: { $cond: ["$any", 1, 0] } },
        },
      },
    ]);
    const studentStats = {};
    for (const row of perStudent) studentStats[String(row._id)] = row;

    const uniqueStudents = await QuizAnswer.distinct("student", { lesson: lesson._id });

    const result = questions.map((q) => {
      const s = statsMap[String(q._id)] || { correct: 0, wrong: 0 };
      const st = studentStats[String(q._id)] || { answered: 0, first_correct: 0, best_correct: 0 };
      return {
        _id: q._id,
        question: q.question,
        type: q.type,
        timestamp: q.timestamp,
        options_count: (q.options || []).length,
        correct: s.correct,
        wrong: s.wrong,
        total: s.correct + s.wrong,
        answered: st.answered,
        first_correct: st.first_correct,
        best_correct: st.best_correct,
      };
    });

    const totalCorrect = result.reduce((s, q) => s + q.correct, 0);
    const totalWrong   = result.reduce((s, q) => s + q.wrong,   0);

    return res.json({
      success: true,
      scoring: "first_try",
      questions: result,
      summary: {
        total_questions: questions.length,
        total_students:  uniqueStudents.length,
        opened:          (lesson.watched || []).length,
        total_attempts:  totalCorrect + totalWrong,
        correct:         totalCorrect,
        wrong:           totalWrong,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
};

module.exports = {
  getQuizQuestions,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  getStudentQuizQuestions,
  submitQuizAnswer,
  getQuizAnalysis,
};
