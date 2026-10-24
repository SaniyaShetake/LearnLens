const {
  Schema,
  model,
  SchemaTypes: { ObjectId }
} = require("mongoose");

const LessonSchema = new Schema(
  {
    // Public slug used in student links (/l/:id)
    id: {
      type: String
    },
    name: {
      type: String,
      maxlength: 128
    },
    desc: {
      type: String,
      maxlength: 500
    },
    user: {
      type: ObjectId,
      ref: "user"
    },
    course: {
      type: ObjectId,
      ref: "course"
    },
    // The video link as the teacher entered it: a YouTube link or a public Google Drive link
    youtube_link: {
      type: String
    },
    // "drive" videos are streamed through GET /api/lessons/:id/video.mp4 (see utils/drive.js)
    video_source: {
      type: String,
      enum: ["youtube", "drive"],
      default: "youtube"
    },
    watched: [
      {
        type: String
      }
    ],
    current_bookmark: {
      type: ObjectId,
      ref: "bookmark"
    },
    bookmarks: [
      {
        type: ObjectId,
        ref: "bookmark"
      }
    ],
    seconds: { type: Number },
    minutes: { type: Number },
    questions: [
      {
        id: Number,
        question: String,
        solution: String
      }
    ],
    // Saved analysis snapshots (POST /api/lessons/:id/analysis)
    analysis: [
      {
        duration: [Number],
        feedback_selected: {
          type: String,
          enum: ["easy", "difficult", "engaging", "boring", null]
        },
        topic: {
          type: String,
          maxlength: 500
        },
        date: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

// Unique slug. A partial index (instead of sparse) so lessons with a null/missing `id` are not
// indexed at all — sparse indexes still index an explicit null. Existing databases: run
// `yarn migrate:slugs` (see documents/DEPLOYMENT.md) to fix null/duplicate slugs and swap the index.
LessonSchema.index({ id: 1 }, { unique: true, partialFilterExpression: { id: { $type: "string" } } });
LessonSchema.index({ user: 1, createdAt: -1 });
LessonSchema.index({ course: 1 });
LessonSchema.index({ bookmarks: 1 });

module.exports = model("lesson", LessonSchema);
