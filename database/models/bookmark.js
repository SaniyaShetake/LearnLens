const { model, Schema } = require("mongoose");

const BookmarkSchema = new Schema({
  time_from: {
    type: Number
  },
  time_to: {
    type: Number
  },
  feedback_type: [
    {
      type: String,
      enum: ["easy", "difficult", "engaging", "boring"]
    }
  ],
  topic: {
    type: String
  },
  threshold: {
    type: Number
  },
  linechart_feedback: [
    {
      type: String,
      enum: ["easy", "difficult", "engaging", "boring", "net_difficult", "net_engaging"]
    }
  ],
  questions: [
    {
      name: {
        type: String
      },
      action: {
        type: String
      },
      date: {
        type: Date,
        default: Date.now
      }
    }
  ],
  actions: [
    {
      question: {
        type: Number
      },
      action: {
        type: String
      },
      future_action: {
        type: String
      },
      date: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

module.exports = model("bookmark", BookmarkSchema);
