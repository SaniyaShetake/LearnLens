const { Schema, model } = require("mongoose");

const RTSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
  token: {
    type: String,
    index: true,
  },
  expire_at: {
    type: Date,
  },
  researcher: {
    type: Schema.Types.ObjectId,
    ref: "researcher",
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: "student",
  },
});

// MongoDB removes expired refresh tokens automatically
RTSchema.index({ expire_at: 1 }, { expireAfterSeconds: 0 });

const RTModel = model("refresh_token", RTSchema);

module.exports = RTModel;
