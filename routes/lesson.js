const router = require("express").Router();
const { verifyMiddleware, rVerifyMiddleware, studentVerifyMiddleware, verifyResourceIsForUser } = require("../middleware/auth");
const {
  saveLessonAnalysis,
  lessonAddBookmark,
  lessonSwitchBookmark,
  lessonSaveBookmark,
  lessonEdit,
  lessonDelete,
  lessonBookmarkAddAction,
  lessonBookmarkAddQuestion,
  lessonBookmarkEditQuestion,
  lessonBookmarkEditAction,
  lessonDeleteBookmark,
} = require("../controllers/lesson");
const { getLesson, checkLessonBelongsToUser,  } = require("../controllers/course");
const { recordFeedback, getAllFeedbackForLesson, watchedVideo, exportFeedbackForLesson } = require("../controllers/feedback");
const { logInteraction, getClickstream } = require('../controllers/log')
const { streamLessonVideo } = require("../controllers/video");
const { videoStreamLimiter } = require("../middleware/rate-limit");
const { getQuizQuestions, createQuizQuestion, updateQuizQuestion, deleteQuizQuestion, getQuizAnalysis } = require("../controllers/quiz");

router.get("/:id", getLesson);
// Public Google Drive lessons are streamed through the server (the ".mp4" lets react-player pick its HTML5 player)
router.get("/:id/video.mp4", videoStreamLimiter(), streamLessonVideo);
router.get("/:id/feedback", verifyMiddleware, verifyResourceIsForUser(checkLessonBelongsToUser), getAllFeedbackForLesson);
router.get("/:id/feedback-export", rVerifyMiddleware, exportFeedbackForLesson);

router.post("/:id", studentVerifyMiddleware, recordFeedback);
router.post("/:id/watched", studentVerifyMiddleware, watchedVideo);
router.post("/:id/log", studentVerifyMiddleware, logInteraction);

router.get("/:id/clickstream",     verifyMiddleware, getClickstream);
router.get("/:id/quiz-analysis",   verifyMiddleware, getQuizAnalysis);
router.post("/:id/analysis", verifyMiddleware, saveLessonAnalysis);

router.put("/bookmark/save/:bookmark_id", verifyMiddleware, lessonSaveBookmark);
router.put("/bookmark/:bookmark_id/add-question", verifyMiddleware, lessonBookmarkAddQuestion);
router.put("/bookmark/:bookmark_id/edit-questions", verifyMiddleware, lessonBookmarkEditQuestion);
router.put("/bookmark/:bookmark_id/add-action", verifyMiddleware, lessonBookmarkAddAction);
router.put("/bookmark/:bookmark_id/edit-actions", verifyMiddleware, lessonBookmarkEditAction);
router.put("/:id", verifyMiddleware, lessonEdit);
router.put("/:id/bookmark/add", verifyMiddleware, lessonAddBookmark);
router.put("/:id/bookmark/switch", verifyMiddleware, lessonSwitchBookmark);
router.put("/:id/bookmark/delete", verifyMiddleware, lessonDeleteBookmark);

router.delete("/:id", verifyMiddleware, lessonDelete);

// Quiz management (teacher)
router.get("/:id/quiz",          verifyMiddleware, getQuizQuestions);
router.post("/:id/quiz",         verifyMiddleware, createQuizQuestion);
router.put("/:id/quiz/:qid",     verifyMiddleware, updateQuizQuestion);
router.delete("/:id/quiz/:qid",  verifyMiddleware, deleteQuizQuestion);

module.exports = router;
