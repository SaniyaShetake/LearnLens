const { Schema, model } = require("mongoose");

const ClientSchema = new Schema(
  {
    identifer_key: {
      type: String,
      required: true
    },
    access_key: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = model("client", ClientSchema);
