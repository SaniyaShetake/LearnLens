const config = require("../config");
const User = require("../database/models/user");
const Researcher = require("../database/models/researcher");
const Student = require("../database/models/student");
const { compareDummyPassword } = require("../utils/crypto");
const LocalStrategy = require("passport-local").Strategy;
const { Strategy: JWTStrategy, ExtractJwt } = require("passport-jwt");

const SELF_SERVICE_FEATURE_LEVELS = ["basic", "advanced"];
const ALLOWED_MODES = ["offline", "online"];

const isNonEmptyString = (x) => typeof x === "string" && x.length > 0;

// Same policy as the password reset forms
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const invalidCredentialsInfo = { status: 400, message: "Please provide a valid email and password." };
const passwordPolicyInfo = {
  status: 400,
  message: `Password length must be between ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`,
};
const accountExistsInfo = { status: 401, message: "Account already exists, please use a different email." };

/** Returns the failure info for a signup email/password pair, or null when acceptable. */
const checkSignupCredentials = (email, password) => {
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) return invalidCredentialsInfo;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return passwordPolicyInfo;
  return null;
};

/**
 * Verifies `password` for `account` (may be null). When the account doesn't exist a dummy bcrypt
 * comparison of the same cost still runs, so response time doesn't reveal registered emails.
 */
const verifyAccountPassword = async (account, password) => {
  if (!account) return compareDummyPassword(password);
  return (await account.verifyPassword(password)) === true;
};
const optionalString = (x) => (typeof x === "string" ? x : undefined);

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.token.secret,
  algorithms: ["HS256"],
};

// Builds a JWT verify callback that only accepts tokens of the given type ("user" | "student" | "researcher")
const verifyTokenOfType = (type, Model) => async (payload, done) => {
  try {
    if (!payload || payload.type !== type || !isNonEmptyString(payload._id)) return done(null, false);
    const account = await Model.findOne({ _id: payload._id });
    if (account) {
      const { _id, email } = account;
      return done(null, { _id, email });
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
};

const signupStrategy = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
    passReqToCallback: true,
  },
  async function (req, email, password, next) {
    try {
      const invalid = checkSignupCredentials(email, password);
      if (invalid) return next(null, false, invalid);
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        const { fullname, organization, mobile_number, contact_for_research, mode, feature_level } = req.body;
        // Only self-service levels are accepted (same as PUT /api/auth/upgrade); anything else falls back to the schema default
        const user = new User({
          email,
          fullname: optionalString(fullname),
          organization: optionalString(organization),
          mobile_number: optionalString(mobile_number),
          mode: ALLOWED_MODES.includes(mode) ? mode : undefined,
          feature_level: SELF_SERVICE_FEATURE_LEVELS.includes(feature_level) ? feature_level : undefined,
          contact_for_research: contact_for_research === "yes",
        });
        user.password = await user.hashPassword(password);
        if (await user.save()) {
          return next(null, { _id: user._id, email });
        }
      }
      return next(null, false, accountExistsInfo);
    } catch (error) {
      console.log(error);
      return next(error, false);
    }
  }
);

const signinStrategy = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
    passReqToCallback: true,
  },
  async function (req, email, password, next) {
    try {
      if (!isNonEmptyString(email) || !isNonEmptyString(password)) return next(null, false);
      const user = await User.findOne({ email });

      if (await verifyAccountPassword(user, password)) {
        return next(null, { _id: user._id, email });
      }
      return next(null, false);
    } catch (error) {
      console.log(error);
      return next(error, false);
    }
  }
);

const verifyStrategy = new JWTStrategy(jwtOptions, verifyTokenOfType("user", User));

const researcherSigninStrategy = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
  },
  async function (email, password, next) {
    try {
      if (!isNonEmptyString(email) || !isNonEmptyString(password)) return next(null, false);
      const user = await Researcher.findOne({ email });

      if (await verifyAccountPassword(user, password)) {
        return next(null, { _id: user._id, email });
      }
      return next(null, false);
    } catch (error) {
      console.log(error);
      return next(error, false);
    }
  }
);

const researcherVerifyStrategy = new JWTStrategy(jwtOptions, verifyTokenOfType("researcher", Researcher));

const studentSignupStrategy = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
    passReqToCallback: true,
  },
  async function (req, email, password, next) {
    try {
      const invalid = checkSignupCredentials(email, password);
      if (invalid) return next(null, false, invalid);
      const existingStudent = await Student.findOne({ email });

      if (!existingStudent) {
        const { name, phone } = req.body;

        const student = new Student({
          email,
          name: optionalString(name),
          phone: optionalString(phone),
        });

        student.password = await student.hashPassword(password);

        if (await student.save()) {
          return next(null, { _id: student._id, email });
        }
      }
      return next(null, false, accountExistsInfo);
    } catch (error) {
      console.log(error);
      return next(error, false);
    }
  }
);

const studentSigninStrategy = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
    passReqToCallback: true,
  },
  async function (_, email, password, next) {
    try {
      if (!isNonEmptyString(email) || !isNonEmptyString(password)) return next(null, false);
      const student = await Student.findOne({ email });

      if (await verifyAccountPassword(student, password)) {
        return next(null, { _id: student._id, email });
      }

      return next(null, false);
    } catch (error) {
      console.log(error);
      return next(error, false);
    }
  }
);

const studentVerifyStrategy = new JWTStrategy(jwtOptions, verifyTokenOfType("student", Student));

module.exports = (passport) => {
  passport.use("signup", signupStrategy);
  passport.use("signin", signinStrategy);
  passport.use("verify", verifyStrategy);

  passport.use("r-signin", researcherSigninStrategy);
  passport.use("r-verify", researcherVerifyStrategy);

  passport.use("student-signup", studentSignupStrategy);
  passport.use("student-signin", studentSigninStrategy);
  passport.use("student-verify", studentVerifyStrategy);
};
