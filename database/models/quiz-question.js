const mongoose = require("mongoose");
const { Schema, Types: { ObjectId } } = mongoose;

const OptionSchema = new Schema(
  { text: { type: String, required: true }, isCorrect: { type: Boolean, default: false } },
  { _id: true }
);

const QuizQuestionSchema = new Schema(
  {
    lesson:     { type: ObjectId, ref: "lesson", required: true },
    question:   { type: String, required: true },
    type:       { type: String, enum: ["mcq", "msq", "true_false"], required: true },
    options:    [OptionSchema],
    timestamp:  { type: Number, required: true, min: 0 }, // seconds into video
    created_by: { type: ObjectId, ref: "user", required: true },
  },
  { timestamps: true }
);

QuizQuestionSchema.index({ lesson: 1, timestamp: 1 });

module.exports = mongoose.model("quiz_question", QuizQuestionSchema);
