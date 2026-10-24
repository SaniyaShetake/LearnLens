const router = require("express").Router();
const { afterAuth, logout, refresh, update, forgotPassword, incrementTour, upgradeFeatureLevel } = require("../controllers/auth");
const {
  signupMiddleware,
  signinMiddleware,
  verifyMiddleware,
  offlineMiddleware,
  signupOfflineMiddleware,
  signinOfflineMiddleware,
  logoutOfflineMiddleware,
  rSigninMiddleware,
  studentSigninMiddleware,
  studentSignupMiddleware,
} = require("../middleware/auth");

const { signinLimiter, signupLimiter, studentSigninLimiter, studentSignupLimiter, forgotPasswordLimiter } = require("../middleware/rate-limit");

const { researcherSignin, researcherRefresh, researcherLogout } = require("../controllers/researcher");

const { afterStudentAuth, studentForgotPassword, studentLogout, studentRefresh } = require("../controllers/student-auth");

router.post("/signup", signupLimiter(), signupMiddleware, afterAuth);
router.post("/signin", signinLimiter(), signinMiddleware, afterAuth);
router.post("/password/forgot", forgotPasswordLimiter(), forgotPassword);
router.post("/logout", logout);
router.post("/refresh", refresh);

router.post("/researcher/signin", signinLimiter(), rSigninMiddleware, researcherSignin);
router.post("/researcher/refresh", researcherRefresh);
router.post("/researcher/logout", researcherLogout);

router.post("/student/signup", studentSignupLimiter(), studentSignupMiddleware, afterStudentAuth);
router.post("/student/signin", studentSigninLimiter(), studentSigninMiddleware, afterStudentAuth);
router.post("/student/password/forgot", forgotPasswordLimiter(), studentForgotPassword);
router.post("/student/logout", studentLogout);
router.post("/student/refresh", studentRefresh);

router.post("/offline-signup", offlineMiddleware, signupOfflineMiddleware, afterAuth);
router.post("/offline-signin", offlineMiddleware, signinOfflineMiddleware, afterAuth);
router.post("/offline-logout", offlineMiddleware, logoutOfflineMiddleware, afterAuth);

router.put("/", verifyMiddleware, update);
router.put("/increment-tour", verifyMiddleware, incrementTour);
router.put("/upgrade", verifyMiddleware, upgradeFeatureLevel);

module.exports = router;
