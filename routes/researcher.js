const router = require("express").Router();
const { researcherLessons, researcherExportLesson, researcherGetUsers, researcherGetLessonLogs } = require("../controllers/researcher");
const { rVerifyMiddleware } = require("../middleware/auth");

router.get("/lessons", rVerifyMiddleware, researcherLessons);
router.get("/lesson/:id", rVerifyMiddleware, researcherExportLesson);
router.get("/lesson/:id/logs", rVerifyMiddleware, researcherGetLessonLogs);
router.get("/users", rVerifyMiddleware, researcherGetUsers);

module.exports = router;
