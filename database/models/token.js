const { model, Schema, SchemaTypes } = require("mongoose");
const { ObjectId } = SchemaTypes;

const TokenSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
      index: true
    },
    user: {
      type: ObjectId,
      ref: "user"
    },
    student: {
      type: ObjectId,
      ref: "student"
    },
    expires_at: {
      type: Date,
      default: () => Date.now() + 86400000 // 1 day
    },
    used: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// MongoDB removes expired reset tokens automatically
TokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = model("token", TokenSchema);
