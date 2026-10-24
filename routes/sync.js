const router = require("express").Router();
const { syncCourse, syncLesson } = require("../controllers/sync");

router.put("/course/:id", syncCourse);
router.put("/lesson/:id", syncLesson);

module.exports = router;
