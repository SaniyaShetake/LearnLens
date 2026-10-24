const { Schema, model, SchemaTypes } = require("mongoose");

const StudentActions = ["login", "logout", "lesson_joined", "play", "pause", "forward_seek", "backward_seek", "lesson_leave"];

const LogSchema = new Schema(
  {
    student: {
      type: SchemaTypes.ObjectId,
      ref: "student",
    },
    action: {
      type: String,
      enum: StudentActions,
    },
    lesson: {
      type: SchemaTypes.ObjectId,
      ref: "lesson",
    },
    duration: {
      type: Number,
    },
    date_client: {
      type: Date,
    },
  },
  { timestamps: true }
);

LogSchema.index({ lesson: 1, student: 1, createdAt: 1 });

module.exports = model("log", LogSchema);
