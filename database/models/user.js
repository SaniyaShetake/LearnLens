const { Schema, model, SchemaTypes } = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("../../config");
const { signAccessToken, comparePassword } = require("../../utils/crypto");

const UserSchema = new Schema({
  fullname: String,
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: String,
  organization: String,
  mobile_number: {
    type: String,
  },
  mode: {
    type: String,
    enum: ["offline", "online"],
  },
  feature_level: {
    type: String,
    enum: ["basic", "advanced"],
    required: true,
    default: "basic",
  },
  contact_for_research: {
    type: Boolean,
    required: true,
    default: false,
  },
  tour: {
    dashboard: {
      type: Number,
      default: 0,
    },
  },
  verified: {
    type: Boolean,
    default: false,
  },
  last_email_request: {
    type: Date,
  },
});

// bcrypt ($2b$) with cost config.saltRounds; hashes created by older bcrypt versions stay valid
UserSchema.methods.hashPassword = function (password) {
  return bcrypt.hash(password, config.saltRounds);
};

// Resolves to a boolean (async bcrypt, does not block the event loop)
UserSchema.methods.verifyPassword = function (password) {
  return comparePassword(password, this.password);
};

UserSchema.methods.genToken = function () {
  return signAccessToken({ _id: this._id, email: this.email }, "user");
};

UserSchema.methods.toWeb = function () {
  let json = Object.assign({}, this._doc);
  delete json._id;
  delete json.password;
  delete json.unique_id;
  return json;
};

module.exports = model("user", UserSchema);
