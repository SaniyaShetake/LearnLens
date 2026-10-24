# Data Flow Diagrams

Companion to [`OVERVIEW.md`](./OVERVIEW.md).

---

## 1. Student feedback capture (write path)

`client/src/pages/lesson-id.jsx` → `POST /api/lessons/:id` → `controllers/feedback.js:recordFeedback`

```mermaid
sequenceDiagram
  participant S as Student browser
  participant P as ReactPlayer (YouTube)
  participant SA as StudentAuthContext
  participant E as Express /api/lessons/:id
  participant DB as MongoDB

  S->>P: watches lecture
  P-->>S: onProgress -> timestamp (1/sec)
  S->>S: click "Difficult"
  Note over S: handleFeedback() PAUSES video<br/>freezing the timestamp
  S->>S: sub-reason grid (from GET /api/misc/columns)
  S->>SA: handleCaputureFeedback(reasonId)
  SA->>E: POST {feedback, timestamp, feedback_type}<br/>Bearer + debe_student_token
  E->>E: student-verify JWT strategy
  E->>DB: Lesson.findOneAndUpdate($addToSet watched)
  E->>DB: new Feedback({seconds, [type]:true, details, ip, student_id})
  DB-->>E: saved
  E-->>SA: {success:true, newFeedback}
  SA->>P: resume playback
```

**`details` dispatch** (`feedback.js:657-663`):

| `feedback_type` | Stored as |
|---|---|
| omitted | `details.none = true` |
| `"other"` | `details.other = other_message` |
| enum id | `details[feedback] = feedback_type` |

---

## 2. Teacher dashboard load (read path)

```mermaid
sequenceDiagram
  participant B as Teacher browser
  participant A as AuthContext
  participant D as LessonIdDashboard
  participant E as Express
  participant PL as Analysis pipeline
  participant DB as MongoDB

  B->>A: page load
  A->>E: POST /api/auth/refresh (debe_token cookie)
  E-->>A: jwt_token -> memoryToken (in JS memory only)
  D->>E: GET /lessons/:id/feedback?min=0  (Bearer)
  E->>E: verifyMiddleware
  E->>E: verifyResourceIsForUser  ← ONLY route with this
  E->>DB: Lesson.findOne().populate(bookmarks current_bookmark)
  E->>DB: Feedback.find({lesson}).sort(createdAt)   ⚠ no index
  E->>PL: run pipeline TWICE (ranged + unranged)
  PL-->>E: 13-key feedback object
  E-->>D: {lesson, feedback}
  D->>D: setLesson / setRange / setData  (FeedbackContext)
  D->>B: render AdvancedDashboard

  B->>D: drag range slider -> setRange
  Note over D: 2nd useEffect, guarded by mounted.current
  D->>E: GET /lessons/:id/feedback?min=&max=
  Note over B: full-page Loader while refreshing
```

---

## 3. Analysis pipeline internals

`controllers/feedback.js` — run twice per request (ranged + unranged).

```mermaid
flowchart TD
  RAW["Feedback.find({lesson})"] --> GRP["group by student_id || unique_id<br/>→ studentSecondArray"]
  GRP --> SMD["generateStudentMinuteData<br/>• trim first/last 1/120th ⚠<br/>• minute = ceil(sec/60), 1-indexed<br/>• OR-merge booleans per minute<br/>• filter min+1 ≤ m ≤ max"]
  SMD --> CF["generateClassFeedback<br/>counts + unique[studentId] detail"]
  SMD --> OV["generateOverlappingData<br/>pairwise co-occurrence"]
  CF --> MW["generateMovingWindowAnalysis<br/>2-min avg; net_difficult / net_engagement"]
  CF --> CD["generateClickDistribution<br/>sums + 2 ratio pairs ⚠ div-by-zero"]
  CF --> VF["generateVennFeedback"]
  MW --> ND["generateNetDistribution → line chart"]
  MW --> PF["generatePercentageFeedback ⚠ wrong divisor"]
  VF --> V1["venn → per-STUDENT counts"]
  VF --> V2["radial → per-CLICK counts (Math.max) ⚠"]
  VF --> V3["participation / unique"]
  VF --> V4["detailed → sortAndCount: top 3 + others"]
```

> ⚠ `venn` (students) and `radial` (clicks) are **different units** from the same function.

---

## 4. Three-identity auth model

```mermaid
flowchart LR
  subgraph Teacher
    T1[POST /auth/signin] --> T2["signin<br/>LocalStrategy"]
    T2 --> T3["afterAuth<br/>JWT + debe_token"]
    T3 --> T4["verify JWT → User"]
  end
  subgraph Student
    S1[POST /auth/student/signin] --> S2["student-signin"]
    S2 --> S3["afterStudentAuth<br/>JWT + debe_student_token<br/>+ login Log"]
    S3 --> S4["student-verify → Student"]
  end
  subgraph Researcher
    R1[POST /auth/researcher/signin] --> R2["r-signin"]
    R2 --> R3["researcherSignin<br/>JWT + debe_researcher_token<br/>⚠ stored in RefreshToken.user"]
    R3 --> R4["r-verify → Researcher"]
  end
  T4 --> SEC["config.token.secret<br/>⚠ ONE shared secret,<br/>payload {_id,email};<br/>separated only by lookup collection"]
  S4 --> SEC
  R4 --> SEC
```

Both auth contexts are mounted simultaneously on `/l/:id`: the teacher `AuthContext` from the app root, plus `ProvideStudentAuth` from `pages/lesson-id.jsx:72`.

---

## 5. Bookmark → Question → Action chain

```mermaid
flowchart TD
  RS["Range slider<br/>[time_from, time_to]"] --> BM
  AC["activated[] chart series"] --> BM
  TP["topic + feedback_type[]"] --> BM
  BM["Bookmark document<br/>(snapshot of dashboard view state)"]
  BM --> Q["questions[]<br/>{name, action, date}"]
  Q -->|"⚠ positional index"| AT["actions[]<br/>{question:Number, action,<br/>future_action, date}"]
  BM -->|"on switch: restores<br/>range + threshold + activated"| DASH["Dashboard view"]
  BM -->|"time_from/time_to become<br/>pipeline min/max when query omits them"| PIPE["Analysis pipeline"]
```

**Persistence:** `questions` / `actions` are edited by **whole-array replacement** (`PUT .../edit-questions`, `.../edit-actions`) — last write wins, no concurrency control. `actions[].question` is a **positional index**, so deleting a question silently re-points every action.

---

## 6. Excel export

```mermaid
flowchart TD
  REQ["GET /lessons/:id/feedback-export<br/>rVerifyMiddleware (RESEARCHER only ⚠)"] --> L["Lesson.findOne"]
  L --> F["Feedback.find({lesson}).sort(seconds)"]
  F --> GRP["group by student, apply edge thresholds"]
  GRP --> LOOP["per student:<br/>Student.findOne / UniqueId.findOne ⚠ N+1"]
  LOOP --> WS["worksheet per student<br/>(name uppercased, collisions get -1/-2)"]
  GRP --> PIPE["generateStudentMinuteData<br/>+ generateClassFeedback"]
  PIPE --> CFS["CLASS FEEDBACK sheet"]
  L --> NF["lesson.watched MINUS responders"]
  NF --> NFS["NO FEEDBACK STUDENTS sheet ⚠ N+1"]
  WS --> FILE["data/generated/lesson-<id>-<ts>.xlsx"]
  CFS --> FILE
  NFS --> FILE
  FILE --> SEND["res.sendFile ⚠ file never deleted"]
```

---

## 7. Request middleware chain (`server.js`)

```
serveFavicon
  → express.json / urlencoded
  → cookieParser                    (must precede all refresh-token reads)
  → cors                            (DEV ONLY)
  → [await db.connect()]            (fail-open: server starts even if Mongo is down)
  → session                         (only if DB connected; vestigial — no route uses it)
  → morgan dev + morgan → debe_online.log   (no rotation)
  → passport.initialize()           (provides req.isAuthenticated())
  → trust proxy = true
  → express.static(public)
  → routes: / · /api/auth · /api/courses · /api/lessons · /api/misc · /api/sync
            (/api/researcher is nested inside routes/index.js)
  → /api/* catch-all → 404
  → [production] static(client/build) + SPA fallback
  → error handler                   ⚠ sets status, NEVER sends → 500s hang
```
