const { Schema, model, SchemaTypes } = require("mongoose");
const { ObjectId } = SchemaTypes;
const { difficultTypes, easyTypes, boringTypes, engagingTypes } = require("../../data/data");

const NewFeedbackSchema = new Schema(
  {
    seconds: {
      type: Number,
      min: 0,
    },
    easy: {
      type: Boolean,
      default: false,
    },
    difficult: {
      type: Boolean,
      default: false,
    },
    engaging: {
      type: Boolean,
      default: false,
    },
    boring: {
      type: Boolean,
      default: false,
    },
    details: {
      difficult: {
        type: String,
        enum: difficultTypes,
      },
      easy: {
        type: String,
        enum: easyTypes,
      },
      boring: {
        type: String,
        enum: boringTypes,
      },
      engaging: {
        type: String,
        enum: engagingTypes,
      },
      other: {
        type: String,
      },
      none: {
        type: Boolean,
      },
    },
    ip: {
      type: String,
    },
    unique_id: {
      type: String,
    },
    student_id: {
      type: ObjectId,
      ref: "student",
    },
    session_id: {
      type: String,
    },
    lesson: {
      type: ObjectId,
      ref: "lesson",
    },
    date_client: {
      type: Date,
    },
  },
  { timestamps: true }
);

NewFeedbackSchema.index({ lesson: 1, createdAt: 1 });

module.exports = model("feedback", NewFeedbackSchema);
