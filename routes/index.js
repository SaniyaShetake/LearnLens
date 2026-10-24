const router = require("express").Router();
// Double-submit CSRF protection; the `_csrf` secret cookie is httpOnly, sameSite=lax, secure in production
const csrfProtect = require("../middleware/csrf");
const { renderResetPassword, resetPassword } = require("../controllers/auth");
const { renderStudentResetPassword, studentResetPassword } = require("../controllers/student-auth");

router.get("/password/reset/:token", csrfProtect, renderResetPassword);
router.post("/password/reset/:token", csrfProtect, resetPassword);

router.get("/student/password/reset/:token", csrfProtect, renderStudentResetPassword);
router.post("/student/password/reset/:token", csrfProtect, studentResetPassword);

router.use("/api/researcher", require("./researcher"));

module.exports = router;
