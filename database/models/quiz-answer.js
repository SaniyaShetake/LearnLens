const mongoose = require("mongoose");
const { Schema, Types: { ObjectId } } = mongoose;

const QuizAnswerSchema = new Schema(
  {
    question: { type: ObjectId, ref: "quiz_question", required: true },
    lesson:   { type: ObjectId, ref: "lesson",        required: true },
    student:  { type: ObjectId, ref: "student",       required: true },
    correct:  { type: Boolean, required: true },
  },
  { timestamps: true }
);

QuizAnswerSchema.index({ lesson: 1, question: 1 });
QuizAnswerSchema.index({ lesson: 1, student: 1 });

module.exports = mongoose.model("quiz_answer", QuizAnswerSchema);
