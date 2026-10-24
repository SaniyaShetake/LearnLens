const { Schema, model } = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("../../config");
const { signAccessToken, comparePassword } = require("../../utils/crypto");

const StudentSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    last_email_request: {
      type: Date,
    },
  },
  { timestamps: true }
);

// bcrypt ($2b$) with cost config.saltRounds; hashes created by older bcrypt versions stay valid
StudentSchema.methods.hashPassword = function (password) {
  return bcrypt.hash(password, config.saltRounds);
};

// Resolves to a boolean (async bcrypt, does not block the event loop)
StudentSchema.methods.verifyPassword = function (password) {
  return comparePassword(password, this.password);
};

StudentSchema.methods.genToken = function () {
  return signAccessToken({ _id: this._id, email: this.email }, "student");
};

StudentSchema.methods.toWeb = function () {
  let json = Object.assign({}, this._doc);
  delete json._id;
  delete json.password;
  delete json.unique_id;
  return json;
};

module.exports = model("student", StudentSchema);
