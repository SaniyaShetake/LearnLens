const router = require("express").Router();
const { verifyMiddleware } = require("../middleware/auth");
const { getAllByUser, getOneCourse, createCourse, addNewLesson, editCourse, deleteCourse, getJoinCode } = require("../controllers/course");

router.get("/", verifyMiddleware, getAllByUser);
router.get("/:id", verifyMiddleware, getOneCourse);
router.get("/:id/join-code", verifyMiddleware, getJoinCode);

router.post("/", verifyMiddleware, createCourse);
router.post("/:id/lesson", verifyMiddleware, addNewLesson);

router.put("/:id", verifyMiddleware, editCourse);

router.delete("/:id", verifyMiddleware, deleteCourse);

module.exports = router;
