const passport = require("passport");
const User = require("../database/models/user");

passport.serializeUser((user, next) => {
  next(null, user._id);
});

// Only used if sessions are ever enabled for passport (all current strategies run with session: false)
passport.deserializeUser((_id, next) => {
  User.findOne({ _id })
    .then((user) => next(null, user ? user.toWeb() : false))
    .catch((err) => next(err, false));
});

require("./strategies")(passport);

module.exports = passport;
