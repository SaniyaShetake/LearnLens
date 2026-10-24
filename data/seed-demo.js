// Seeds demo data for an EXISTING teacher account (the teacher document is never created or
// modified):
//   - two demo courses with lessons, bookmarks and quiz questions
//   - demo students enrolled in EVERY course of the teacher (demo + the teacher's own courses)
//   - for every lesson: feedback, clickstream logs and quiz answers from the demo students
//   - quiz questions for the teacher's own lessons that have none (existing questions are kept and
//     simply get demo answers)
//
//   yarn seed:demo                       # teacher defaults to DEMO_TEACHER_EMAIL below
//   yarn seed:demo --teacher a@b.com
//
// Re-running is safe: everything the previous run added (demo students and all their activity,
// demo courses, quiz questions added to the teacher's own lessons) is removed first. Demo course
// and lesson ids, student links and join codes are kept, so open dashboards and shared links keep
// working. The teacher's real data is never touched. Results are deterministic (seeded PRNG).
//
// How the data maps onto the dashboard panels (see controllers/quiz.js and controllers/log.js):
//   Quiz Analysis: scored on each student's FIRST answer; verdicts Reteach <40%, Discuss 40-69%,
//     Nearly there 70-79%, Got it 80%+, "Too few answers" under 5. Retries are extra answers and
//     show up as "X% after retries". Every question below declares the first-try rate it targets.
//   Clickstream: counted in distinct students per minute; `duration` is the video position and
//     seeks are logged where the student LANDED (like the player does). "Review" moments need
//     >= 3 students and >= 60% of the peak in the same minute, so replays/skips are clustered.
//     The player pauses for each quiz pop-up, so quiz times show pause spikes too.
const mongoose = require("mongoose");
const { db } = require("../database");
const User = require("../database/models/user");
const Student = require("../database/models/student");
const Course = require("../database/models/course");
const Lesson = require("../database/models/lesson");
const Feedback = require("../database/models/feedback");
const Log = require("../database/models/log");
const Bookmark = require("../database/models/bookmark");
const QuizQuestion = require("../database/models/quiz-question");
const QuizAnswer = require("../database/models/quiz-answer");
const { genSlug } = require("../utils/slug");
const { randomString } = require("../utils/random");
const { difficultTypes, easyTypes, boringTypes, engagingTypes } = require("./data");

const DEMO_TEACHER_EMAIL = "umerapirjade786@gmail.com";
const DEMO_STUDENT_DOMAIN = "demo.tcherly.local";
const DEMO_STUDENT_PASSWORD = "Demo@1234";
const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const META_COLLECTION = "demo_seed_meta"; // remembers quiz questions added to the teacher's own lessons

const STUDENT_NAMES = [
  "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Ananya Iyer", "Vikram Singh", "Sneha Kulkarni",
  "Arjun Nair", "Kavya Reddy", "Ishaan Gupta", "Meera Joshi", "Rahul Desai", "Diya Kapoor",
  "Karan Malhotra", "Pooja Verma", "Siddharth Rao", "Neha Bhatt", "Aditya Kumar", "Riya Sen",
  "Varun Chopra", "Tanvi Shah", "Nikhil Jain", "Aisha Khan", "Yash Pandey", "Shreya Das",
];

// Quiz option helper: [text, isCorrect]
const TF = (answer) => [["True", answer], ["False", !answer]];

// `first` = target first-try success rate, `retry` = share of wrong first answers retried correctly,
// `reach` (optional) = share of viewers shown the question (demonstrates "Too few answers").
// Ranges are in seconds. Bookmark from/to are seconds too (stored as minutes, like the dashboard).
const DEMO_COURSES = [
  {
    name: "Machine Learning Foundations",
    lessons: [
      {
        name: "What is a Neural Network?",
        desc: "Neurons, layers and weights explained visually.",
        youtube_link: "https://www.youtube.com/watch?v=aircAruvnKk",
        seconds: 1153,
        difficult: [[480, 640]], boring: [[880, 980]], engaging: [[60, 240], [1000, 1120]],
        quiz: [
          { t: 200, first: 0.92, retry: 0.5, q: "What does a single neuron hold in this model?", type: "mcq", options: [["A number between 0 and 1", true], ["An image", false], ["A program", false], ["A list of weights only", false]] },
          { t: 560, first: 0.3, retry: 0.7, q: "What does the bias of a neuron control?", type: "mcq", options: [["How high the weighted sum must be before it activates", true], ["The number of layers", false], ["The learning rate", false], ["The size of the input image", false]] },
          { t: 700, first: 0.75, retry: 0.6, q: "Weights and biases are what the network learns.", type: "true_false", options: TF(true) },
          { t: 1050, first: 0.55, retry: 0.6, q: "Which of these are hidden-layer ideas from the video?", type: "msq", options: [["Detecting edges", true], ["Detecting loops and lines", true], ["Storing the final label", false]] },
        ],
        bookmark: { from: 480, to: 640, type: ["difficult"], topic: "Weights, biases and the sigmoid", question: "Why did difficulty spike around minutes 8-10?", action: "Add a worked example of a weighted sum before introducing sigmoid" },
      },
      {
        name: "Gradient Descent",
        desc: "How neural networks learn by minimising a cost function.",
        youtube_link: "https://www.youtube.com/watch?v=IHZwWFHWa-w",
        seconds: 1261,
        difficult: [[840, 960]], boring: [[1100, 1200]], engaging: [[120, 280]],
        quiz: [
          { t: 240, first: 0.85, retry: 0.5, q: "The cost function measures…", type: "mcq", options: [["How wrong the network's outputs are", true], ["How long training takes", false], ["How many neurons there are", false]] },
          { t: 900, first: 0.35, retry: 0.65, q: "Gradient descent moves parameters in which direction?", type: "mcq", options: [["Opposite to the gradient", true], ["Along the gradient", false], ["Randomly", false], ["Perpendicular to the gradient", false]] },
          { t: 1000, first: 0.6, retry: 0.5, q: "Which of these are hyperparameters?", type: "msq", options: [["Learning rate", true], ["Number of layers", true], ["Individual weights", false]] },
        ],
        bookmark: { from: 840, to: 960, type: ["difficult", "boring"], topic: "Cost function landscape", question: "Students lost track during the multi-dimensional cost discussion", action: "Use a 2D contour plot before generalising to many dimensions" },
      },
      {
        name: "Backpropagation Intuition",
        desc: "What backpropagation is really doing.",
        youtube_link: "https://www.youtube.com/watch?v=Ilg3gGewQ5U",
        seconds: 834,
        difficult: [[360, 520]], boring: [[620, 700]], engaging: [[40, 180]],
        quiz: [
          { t: 150, first: 0.88, retry: 0.5, q: "Backpropagation is used to compute…", type: "mcq", options: [["The gradient of the cost", true], ["The network's output", false], ["The training data", false]] },
          { t: 450, first: 0.45, retry: 0.6, q: "Backpropagation computes the gradient with respect to every weight.", type: "true_false", options: TF(true) },
          { t: 790, first: 0.7, retry: 0.5, reach: 0.2, q: "Stochastic gradient descent uses…", type: "mcq", options: [["Small random mini-batches", true], ["The full dataset every step", false], ["No data at all", false]] },
        ],
      },
    ],
  },
  {
    name: "Linear Algebra Essentials",
    lessons: [
      {
        name: "Vectors",
        desc: "What vectors are, from physics, CS and maths perspectives.",
        youtube_link: "https://www.youtube.com/watch?v=fNk_zzaMoSs",
        seconds: 592,
        difficult: [[400, 480]], boring: [[200, 280]], engaging: [[40, 140], [500, 560]],
        quiz: [
          { t: 150, first: 0.9, retry: 0.5, q: "To a computer scientist, a vector is…", type: "mcq", options: [["An ordered list of numbers", true], ["An arrow with no coordinates", false], ["A single number", false]] },
          { t: 300, first: 0.78, retry: 0.6, q: "Adding two vectors geometrically means…", type: "mcq", options: [["Placing them tip to tail", true], ["Multiplying their lengths", false], ["Averaging their angles", false]] },
          { t: 450, first: 0.38, retry: 0.7, q: "Multiplying a vector by -2 flips it and doubles its length.", type: "true_false", options: TF(true) },
        ],
      },
      {
        name: "Linear Combinations, Span and Basis",
        desc: "Scaling and adding vectors, and the space they reach.",
        youtube_link: "https://www.youtube.com/watch?v=k7RM-ot2NWY",
        seconds: 599,
        difficult: [[260, 400]], boring: [[480, 540]], engaging: [[60, 200]],
        quiz: [
          { t: 180, first: 0.82, retry: 0.5, q: "î and ĵ are called the…", type: "mcq", options: [["Basis vectors", true], ["Eigenvectors", false], ["Null vectors", false]] },
          { t: 330, first: 0.28, retry: 0.75, q: "Which sets of 2D vectors span the whole plane?", type: "msq", options: [["Two non-parallel vectors", true], ["Two vectors on the same line", false], ["The zero vector alone", false]] },
          { t: 450, first: 0.62, retry: 0.6, q: "Linearly dependent vectors add a new dimension to the span.", type: "true_false", options: TF(false) },
        ],
        bookmark: { from: 260, to: 400, type: ["difficult"], topic: "Span and linear dependence", question: "Why is linear dependence confusing?", action: "Show an interactive example of a redundant vector" },
      },
      {
        name: "Linear Transformations and Matrices",
        desc: "Matrices as transformations of space.",
        youtube_link: "https://www.youtube.com/watch?v=kYB8IZa5AuE",
        seconds: 658,
        difficult: [[330, 470]], boring: [[560, 620]], engaging: [[90, 300]],
        quiz: [
          { t: 200, first: 0.86, retry: 0.5, q: "A linear transformation keeps grid lines…", type: "mcq", options: [["Parallel and evenly spaced", true], ["Curved", false], ["Randomly spaced", false]] },
          { t: 400, first: 0.33, retry: 0.7, q: "The columns of a 2×2 matrix tell you…", type: "mcq", options: [["Where î and ĵ land", true], ["The determinant", false], ["The eigenvalues", false]] },
          { t: 600, first: 0.72, retry: 0.5, q: "The origin stays fixed under a linear transformation.", type: "true_false", options: TF(true) },
        ],
      },
    ],
  },
];

// Quiz questions added to the teacher's OWN lessons that have none (matched to the video topics),
// keyed by lesson _id. Lessons with existing questions keep theirs and get demo answers.
const OWN_LESSON_QUIZZES = {
  // BLOCKCHAIN · CHAPTER 3 — "How to Become a Blockchain Developer"
  "6abcb461b1f2e8107e4d4791": [
    { t: 120, first: 0.85, retry: 0.5, q: "Which language is most commonly used for Ethereum smart contracts?", type: "mcq", options: [["Solidity", true], ["Python", false], ["COBOL", false], ["HTML", false]] },
    { t: 300, first: 0.36, retry: 0.7, q: "Which skills are core for a blockchain developer?", type: "msq", options: [["Cryptography basics", true], ["Data structures", true], ["Graphic design", false]] },
    { t: 450, first: 0.72, retry: 0.5, q: "A blockchain developer only needs front-end skills.", type: "true_false", options: TF(false) },
  ],
  // BLOCKCHAIN · CHAPTER 4 — "Blockchain Explained"
  "6abcb4b1b1f2e8107e4d47a0": [
    { t: 150, first: 0.9, retry: 0.5, q: "What links each block to the previous one?", type: "mcq", options: [["The previous block's hash", true], ["A timestamp only", false], ["The miner's name", false], ["A password", false]] },
    { t: 330, first: 0.31, retry: 0.7, q: "Changing one block requires recomputing all the blocks after it.", type: "true_false", options: TF(true) },
    { t: 520, first: 0.58, retry: 0.6, q: "What is the main purpose of a consensus mechanism?", type: "mcq", options: [["Agreeing on the valid state of the ledger", true], ["Encrypting user passwords", false], ["Speeding up the internet", false], ["Storing large files", false]] },
  ],
  // BLOCKCHAIN · CHAPTER 5 — "What is Bitcoin & How it Works"
  "6abcb4dfb1f2e8107e4d47a8": [
    { t: 90, first: 0.88, retry: 0.5, q: "Who introduced Bitcoin?", type: "mcq", options: [["Satoshi Nakamoto", true], ["Vitalik Buterin", false], ["Elon Musk", false], ["Tim Berners-Lee", false]] },
    { t: 200, first: 0.65, retry: 0.6, q: "The total supply of Bitcoin is capped at 21 million.", type: "true_false", options: TF(true) },
    { t: 300, first: 0.34, retry: 0.7, q: "What do miners receive for adding a block?", type: "mcq", options: [["The block reward plus transaction fees", true], ["A share of every wallet", false], ["Nothing, mining is voluntary", false]] },
  ],
  // BLOCKCHAIN · BLOCHAIN ARCHITECTURE — "Blockchain Architecture & Design" (has one question already)
  "6abd35ee7969a55363ad4ae0": [
    { t: 600, first: 0.8, retry: 0.5, q: "In a peer-to-peer network, every node…", type: "mcq", options: [["Can act as both client and server", true], ["Must connect to one central server", false], ["Only stores its own data", false]] },
    { t: 1300, first: 0.52, retry: 0.6, q: "Which are types of blockchain?", type: "msq", options: [["Public", true], ["Private", true], ["Consortium", true], ["Centralized", false]] },
    { t: 2000, first: 0.76, retry: 0.5, q: "Proof of Work requires solving a computational puzzle.", type: "true_false", options: TF(true) },
    { t: 2400, first: 0.3, retry: 0.7, q: "What is a Merkle tree used for in a block?", type: "mcq", options: [["Efficiently verifying transactions", true], ["Choosing the next miner", false], ["Storing private keys", false]] },
  ],
  // DS · DATA SCIENCE — "What is Data Science?"
  "6aba4f0ad8cdcb053bbf2301": [
    { t: 100, first: 0.87, retry: 0.5, q: "Data science combines statistics, programming and…", type: "mcq", options: [["Domain knowledge", true], ["Hardware repair", false], ["Graphic design", false]] },
    { t: 250, first: 0.42, retry: 0.6, q: "Which are steps in the data science lifecycle?", type: "msq", options: [["Data collection", true], ["Data cleaning", true], ["Model building", true], ["Hardware assembly", false]] },
    { t: 400, first: 0.74, retry: 0.5, q: "Data visualisation is only useful after a model is deployed.", type: "true_false", options: TF(false) },
  ],
  // RM · Chapter 1 — "What is Data Science? | Introduction to Data Science"
  "6aba18bd2604b8a879c57342": [
    { t: 300, first: 0.9, retry: 0.5, q: "What is the first step in a data science project?", type: "mcq", options: [["Understanding the business problem", true], ["Training a model", false], ["Buying servers", false]] },
    { t: 900, first: 0.78, retry: 0.6, q: "Data scientists spend a large share of their time cleaning and preparing data.", type: "true_false", options: TF(true) },
    { t: 1600, first: 0.32, retry: 0.7, q: "Which is a supervised learning task?", type: "mcq", options: [["Predicting house prices from labelled data", true], ["Grouping customers without labels", false], ["Compressing images", false]] },
    { t: 2300, first: 0.56, retry: 0.6, q: "Which tools are commonly used in data science?", type: "msq", options: [["Python", true], ["R", true], ["SQL", true], ["Photoshop", false]] },
    { t: 2800, first: 0.7, retry: 0.5, q: "A confusion matrix evaluates…", type: "mcq", options: [["A classification model's performance", true], ["Database speed", false], ["Data storage size", false]] },
  ],
  // RM · Chapter 2 — "Introduction to BIG Data | Small Data Vs BIG Data"
  "6abb9af5896c6aa70bc927c1": [
    { t: 150, first: 0.37, retry: 0.7, q: "Which of these are V's of Big Data?", type: "msq", options: [["Volume", true], ["Velocity", true], ["Variety", true], ["Visibility", false]] },
    { t: 400, first: 0.84, retry: 0.5, q: "Small data can usually be processed on a single machine.", type: "true_false", options: TF(true) },
    { t: 650, first: 0.6, retry: 0.6, q: "Which is an example of big data?", type: "mcq", options: [["Social media posts generated every second", true], ["A class attendance sheet", false], ["A shopping list", false]] },
  ],
};

// First-try targets cycled over the teacher's existing questions, so they show a mix of verdicts
const EXISTING_QUESTION_TARGETS = [
  { first: 0.88, retry: 0.5 }, { first: 0.55, retry: 0.6 }, { first: 0.32, retry: 0.7 }, { first: 0.75, retry: 0.5 },
];

// ---------------------------------------------------------------------------------------------
// Deterministic PRNG so every run produces the same numbers (mulberry32)
let prngState = 20261001;
const rand = () => {
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const inRanges = (t, ranges) => ranges.some(([a, b]) => t >= a && t <= b);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const DETAIL_TYPES = { difficult: difficultTypes, easy: easyTypes, boring: boringTypes, engaging: engagingTypes };

const parseTeacherArg = () => {
  const i = process.argv.indexOf("--teacher");
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1].toLowerCase() : DEMO_TEACHER_EMAIL;
};

const uniqueJoinCode = async () => {
  for (let i = 0; i < 10; i++) {
    const code = randomString({ length: 6, characters: JOIN_CODE_CHARS });
    if (!(await Course.exists({ join_code: code }))) return code;
  }
  throw new Error("Could not generate a unique join code");
};

/** Viewing profile for a lesson we have no hand-written profile for, derived from its length. */
const autoProfile = (seconds, variant) => {
  const s = (f) => Math.round(seconds * f);
  const shift = (variant % 3) * 0.04;
  return {
    difficult: [[s(0.36 + shift), s(0.5 + shift)]],
    boring: [[s(0.62 + shift), s(0.72 + shift)]],
    engaging: [[s(0.08), s(0.22)], [s(0.84), s(0.94)]],
  };
};

/** Picks the reaction a student gives at second `t`, weighted by the lesson's hot spots. */
const reactionAt = (profile, t) => {
  const weights = { difficult: 1, easy: 1.5, boring: 1, engaging: 1.5 };
  if (inRanges(t, profile.difficult)) weights.difficult += 7;
  if (inRanges(t, profile.boring)) weights.boring += 6;
  if (inRanges(t, profile.engaging)) weights.engaging += 6;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const [k, w] of Object.entries(weights)) if ((r -= w) < 0) return k;
  return "easy";
};

// ---------------------------------------------------------------------------------------------
const meta = () => mongoose.connection.collection(META_COLLECTION);

const removePreviousDemo = async (teacher) => {
  const demoStudents = await Student.find({ email: new RegExp(`@${DEMO_STUDENT_DOMAIN.replace(/\./g, "\\.")}$`) }).select("_id");
  const studentIds = demoStudents.map((s) => s._id);
  const courses = await Course.find({ user: teacher._id, name: { $in: DEMO_COURSES.map((c) => c.name) } }).select("_id name join_code");
  const courseIds = courses.map((c) => c._id);
  const lessons = await Lesson.find({ course: { $in: courseIds } }).select("_id id name course bookmarks");
  const lessonIds = lessons.map((l) => l._id);
  const bookmarkIds = lessons.flatMap((l) => l.bookmarks || []);
  const added = (await meta().findOne({ _id: `${teacher._id}:quiz_questions` })) || { ids: [] };

  await Promise.all([
    Feedback.deleteMany({ $or: [{ lesson: { $in: lessonIds } }, { student_id: { $in: studentIds } }] }),
    Log.deleteMany({ $or: [{ lesson: { $in: lessonIds } }, { student: { $in: studentIds } }] }),
    QuizAnswer.deleteMany({ $or: [{ lesson: { $in: lessonIds } }, { student: { $in: studentIds } }, { question: { $in: added.ids } }] }),
    QuizQuestion.deleteMany({ $or: [{ lesson: { $in: lessonIds } }, { _id: { $in: added.ids } }] }),
    Bookmark.deleteMany({ _id: { $in: bookmarkIds } }),
    Lesson.deleteMany({ _id: { $in: lessonIds } }),
    Course.deleteMany({ _id: { $in: courseIds } }),
  ]);
  // Detach demo students from the teacher's own courses/lessons before deleting them
  await Course.updateMany({ students: { $in: studentIds } }, { $pull: { students: { $in: studentIds } } });
  await Lesson.updateMany({ watched: { $in: studentIds.map(String) } }, { $pull: { watched: { $in: studentIds.map(String) } } });
  await Student.deleteMany({ _id: { $in: studentIds } });
  await meta().deleteOne({ _id: `${teacher._id}:quiz_questions` });

  // Identities to reuse so open dashboards, shared student links and join codes keep working
  const previous = {};
  for (const c of courses) {
    previous[c.name] = { _id: c._id, join_code: c.join_code, lessons: {} };
    for (const l of lessons.filter((x) => String(x.course) === String(c._id))) previous[c.name].lessons[l.name] = { _id: l._id, id: l.id };
  }
  return {
    removed: { students: studentIds.length, courses: courseIds.length, lessons: lessonIds.length, addedQuestions: added.ids.length },
    previous,
  };
};

// ---------------------------------------------------------------------------------------------
/**
 * Simulates every viewer watching one lesson and returns { feedback, logs, reached }.
 * `quizTimes` are the question timestamps (the player pauses there for the pop-up).
 */
const simulateViewing = ({ lesson, profile, viewers, quizTimes, windowStart, windowEnd }) => {
  const seconds = lesson.seconds;
  const feedback = [];
  const logs = [];
  const reached = new Map();
  const [boringFrom, boringTo] = profile.boring[0] || [seconds, seconds];
  const span = Math.max(1, windowEnd - windowStart - (seconds + 3600) * 1000);

  for (const student of viewers) {
    const sid = student._id;
    let wall = windowStart + rand() * span; // when this student starts watching
    let pos = 0;
    const session_id = randomString({ length: 16 });
    const log = (action, duration, gap = 1) => {
      wall += gap * 1000;
      logs.push({ student: sid, lesson: lesson._id, action, duration: Math.round(duration), date_client: new Date(wall), createdAt: new Date(wall), updatedAt: new Date(wall) });
    };
    const advanceTo = (to) => {
      wall += Math.max(0, to - pos) * 1000;
      pos = to;
    };

    // Where this student stops: ~65% finish; of the rest, half give up in the boring stretch
    let stopAt = seconds;
    const r = rand();
    if (r < 0.18) stopAt = randInt(boringFrom, Math.max(boringFrom, boringTo));
    else if (r < 0.35) stopAt = randInt(Math.floor(seconds * 0.15), Math.floor(seconds * 0.9));
    stopAt = clamp(stopAt, 30, seconds);

    const replays = rand() < 0.75; // goes back over the hard part
    const skips = rand() < 0.6; // skips the boring part
    const thinker = rand() < 0.35; // pauses to take notes in the hard part
    let replayed = false;
    let skipped = false;

    log("lesson_joined", 0, 0);
    log("play", 0, randInt(2, 15));

    // Walk through the video in feedback-sized steps
    let next = randInt(35, 70);
    const events = [...quizTimes.map((t) => ({ t, kind: "quiz" }))];
    while (pos < stopAt) {
      const stepTo = Math.min(next, stopAt);
      // Quiz pop-ups crossed in this step pause the video
      for (const e of events.filter((e) => !e.done && e.t > pos && e.t <= stepTo)) {
        advanceTo(e.t);
        log("pause", e.t, 0);
        log("play", e.t, randInt(15, 50));
        e.done = true;
      }
      const prevPos = pos;
      advanceTo(stepTo);
      if (pos >= stopAt) break;

      // Students land in the same minute so the per-minute counts cluster into a visible moment
      const minuteOf = (s) => Math.floor(s / 60) * 60;

      // Skip ahead over the boring part (a step can cross it entirely): logged where the student lands
      if (skips && !skipped && prevPos < boringTo && pos >= boringFrom) {
        skipped = true;
        const land = clamp(Math.max(minuteOf(boringTo), boringFrom) + randInt(0, 40), pos + 5, seconds - 1);
        if (land >= stopAt) stopAt = Math.min(seconds, land + 60);
        log("forward_seek", land, 1);
        pos = land;
        next = pos + randInt(25, 60);
        continue;
      }

      // Feedback click (skipping the first/last 30s, which the dashboard ignores)
      if (pos >= 35 && pos <= seconds - 35) {
        const kind = reactionAt(profile, pos);
        const at = new Date(wall);
        feedback.push({
          seconds: pos,
          easy: kind === "easy",
          difficult: kind === "difficult",
          engaging: kind === "engaging",
          boring: kind === "boring",
          details: rand() < 0.75 ? { [kind]: pick(DETAIL_TYPES[kind]) } : { none: true },
          student_id: sid,
          session_id,
          lesson: lesson._id,
          date_client: at,
          createdAt: at,
          updatedAt: at,
        });
      }

      const hard = profile.difficult.find(([a, b]) => pos >= a && pos <= b);
      if (hard && thinker && rand() < 0.5) {
        log("pause", pos, 0);
        log("play", pos, randInt(20, 90));
      }
      // Jump back to the start of the hard part once the student reaches its second half
      const crossed = profile.difficult.find(([a, b]) => prevPos <= b && pos >= a + (b - a) * 0.5);
      if (crossed && replays && !replayed) {
        replayed = true;
        const land = clamp(Math.max(minuteOf(crossed[0]), crossed[0] - 30) + randInt(0, 30), 0, pos - 6);
        log("pause", pos, 0);
        log("backward_seek", land, randInt(2, 8));
        pos = land;
        next = pos + randInt(25, 60);
        continue;
      }
      if (rand() < 0.04) {
        log("pause", pos, 0);
        log("play", pos, randInt(10, 120));
      }
      next = pos + randInt(25, 70);
    }

    if (stopAt < seconds) log("pause", stopAt, 0);
    log("lesson_leave", stopAt, 1);
    reached.set(String(sid), stopAt);
  }
  return { feedback, logs, reached };
};

/** Quiz answers with an exact first-try success rate and retries for some wrong answers. */
const answerQuestions = ({ lesson, questions, viewers, reached, logs }) => {
  const answers = [];
  // Answer time = the student's quiz pause log at that timestamp (falls back to its leave time)
  const timeOf = (sid, t) => {
    const entry = logs.find((l) => String(l.student) === sid && l.action === "pause" && l.duration === t);
    return entry ? entry.createdAt.getTime() : Date.now() - 86400000;
  };
  for (const { doc, first, retry, reach = 1 } of questions) {
    let eligible = shuffle(viewers.filter((s) => (reached.get(String(s._id)) || 0) >= doc.timestamp));
    if (reach < 1) eligible = eligible.slice(0, Math.max(1, Math.round(eligible.length * reach)));
    const nRight = Math.round(eligible.length * first);
    eligible.forEach((s, i) => {
      const sid = String(s._id);
      const at = timeOf(sid, doc.timestamp) + randInt(5, 20) * 1000;
      const right = i < nRight;
      answers.push({ question: doc._id, lesson: lesson._id, student: s._id, correct: right, createdAt: new Date(at), updatedAt: new Date(at) });
      if (!right && rand() < retry) {
        const later = new Date(at + randInt(20, 90) * 1000);
        answers.push({ question: doc._id, lesson: lesson._id, student: s._id, correct: true, createdAt: later, updatedAt: later });
      }
    });
  }
  return answers;
};

// ---------------------------------------------------------------------------------------------
const seed = async () => {
  const teacherEmail = parseTeacherArg();
  await db.connect();

  const teacher = await User.findOne({ email: teacherEmail });
  if (!teacher) throw new Error(`Teacher "${teacherEmail}" not found. Sign up with that email first (the seed never creates teachers).`);
  console.log(`Seeding demo data for teacher ${teacher.fullname} <${teacher.email}>`);

  const { removed, previous } = await removePreviousDemo(teacher);
  if (removed.students || removed.courses) console.log("Removed previous demo data:", removed);

  const hash = await new Student().hashPassword(DEMO_STUDENT_PASSWORD);
  const students = await Student.insertMany(
    STUDENT_NAMES.map((name) => ({ name, email: `${name.split(" ")[0].toLowerCase()}@${DEMO_STUDENT_DOMAIN}`, password: hash }))
  );

  const now = Date.now();
  const DAY = 86400000;
  const addedQuestionIds = [];
  const report = [];

  // 1. Demo courses and lessons (stable ids across runs)
  for (const [ci, def] of DEMO_COURSES.entries()) {
    const prevCourse = previous[def.name] || { lessons: {} };
    const course = await Course.create({
      ...(prevCourse._id && { _id: prevCourse._id }),
      name: def.name,
      user: teacher._id,
      join_code: prevCourse.join_code || (await uniqueJoinCode()),
      createdAt: new Date(now - (24 - ci * 3) * DAY),
    });
    for (const [li, ldef] of def.lessons.entries()) {
      const prevLesson = prevCourse.lessons[ldef.name] || {};
      const lesson = new Lesson({
        ...(prevLesson._id && { _id: prevLesson._id }),
        id: /^[A-Za-z0-9-]+$/.test(prevLesson.id || "") ? prevLesson.id : genSlug(ldef.name),
        name: ldef.name,
        desc: ldef.desc,
        user: teacher._id,
        course: course._id,
        youtube_link: ldef.youtube_link,
        seconds: ldef.seconds,
        minutes: Math.ceil(ldef.seconds / 60),
        createdAt: new Date(now - (21 - ci * 3 - li * 3) * DAY),
      });
      if (ldef.bookmark) {
        const b = ldef.bookmark;
        const bookmark = await Bookmark.create({
          // Bookmarks store the dashboard range, which is in MINUTES
          time_from: Math.floor(b.from / 60),
          time_to: Math.ceil(b.to / 60),
          feedback_type: b.type,
          topic: b.topic,
          threshold: 50,
          linechart_feedback: ["net_difficult", "net_engaging"],
          questions: [{ name: b.question, action: b.action }],
          actions: [{ question: 0, action: b.action, future_action: "Review the effect in the next lecture's feedback" }],
        });
        lesson.bookmarks = [bookmark._id];
        lesson.current_bookmark = bookmark._id;
      }
      await lesson.save();
      course.lessons.push(lesson._id);
    }
    await course.save();
  }

  // 2. Every course of the teacher (demo + own) gets demo students and activity
  const demoDefs = new Map(DEMO_COURSES.flatMap((c) => c.lessons.map((l) => [l.name + "|" + c.name, l])));
  const allCourses = await Course.find({ user: teacher._id }).sort({ createdAt: 1 });

  for (const [ci, course] of allCourses.entries()) {
    const isDemo = DEMO_COURSES.some((c) => c.name === course.name);
    // ~20 of the 24 demo students per course, a different few sit out each course
    const enrolled = students.filter((_, i) => (i + ci * 5) % 24 >= 4);
    await Course.updateOne({ _id: course._id }, { $addToSet: { students: { $each: enrolled.map((s) => s._id) } } });

    const lessons = await Lesson.find({ _id: { $in: course.lessons } }).sort({ createdAt: 1 });
    for (const [li, lesson] of lessons.entries()) {
      if (!lesson.seconds) continue;
      const ldef = isDemo ? demoDefs.get(lesson.name + "|" + course.name) : null;
      const profile = ldef ? { difficult: ldef.difficult, boring: ldef.boring, engaging: ldef.engaging } : autoProfile(lesson.seconds, ci + li);

      // Quiz questions: demo lessons get theirs, own lessons get topic questions if they have none
      let questions = [];
      if (ldef) {
        for (const q of ldef.quiz) {
          const doc = await QuizQuestion.create({ lesson: lesson._id, question: q.q, type: q.type, options: q.options.map(([text, isCorrect]) => ({ text, isCorrect })), timestamp: q.t, created_by: teacher._id });
          questions.push({ doc, ...q });
        }
      } else {
        const existing = await QuizQuestion.find({ lesson: lesson._id }).sort({ timestamp: 1 });
        existing.forEach((doc, i) => questions.push({ doc, ...EXISTING_QUESTION_TARGETS[(i + li) % EXISTING_QUESTION_TARGETS.length] }));
        for (const q of OWN_LESSON_QUIZZES[String(lesson._id)] || []) {
          if (q.t >= lesson.seconds) continue;
          const doc = await QuizQuestion.create({ lesson: lesson._id, question: q.q, type: q.type, options: q.options.map(([text, isCorrect]) => ({ text, isCorrect })), timestamp: q.t, created_by: teacher._id });
          addedQuestionIds.push(doc._id);
          questions.push({ doc, ...q });
        }
        questions.sort((a, b) => a.doc.timestamp - b.doc.timestamp);
      }

      // Later lessons in a course are opened by fewer students
      const viewers = enrolled.filter(() => rand() < 0.97 - li * 0.06);
      const windowStart = Math.max(new Date(lesson.createdAt).getTime(), now - 21 * DAY);
      const { feedback, logs, reached } = simulateViewing({
        lesson,
        profile,
        viewers,
        quizTimes: questions.map((q) => q.doc.timestamp),
        windowStart,
        windowEnd: now,
      });
      const answers = answerQuestions({ lesson, questions, viewers, reached, logs });

      await Feedback.insertMany(feedback, { timestamps: false });
      await Log.insertMany(logs, { timestamps: false });
      await QuizAnswer.insertMany(answers, { timestamps: false });
      await Lesson.updateOne({ _id: lesson._id }, { $addToSet: { watched: { $each: viewers.map((s) => String(s._id)) } } });

      report.push({ course: course.name, lesson: lesson.name, viewers: viewers.length, feedback: feedback.length, logs: logs.length, questions: questions.length, answers: answers.length });
    }
  }

  if (addedQuestionIds.length) await meta().updateOne({ _id: `${teacher._id}:quiz_questions` }, { $set: { ids: addedQuestionIds } }, { upsert: true });

  console.table(report);
  console.log(`Demo students: ${students.length}, quiz questions added to your own lessons: ${addedQuestionIds.length}`);
  console.log(`Demo students log in with <firstname>@${DEMO_STUDENT_DOMAIN} / ${DEMO_STUDENT_PASSWORD} (e.g. aarav@${DEMO_STUDENT_DOMAIN})`);
};

seed()
  .then(() => db.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error.stack || error.message || error);
    await db.disconnect().catch(() => null);
    process.exit(1);
  });
