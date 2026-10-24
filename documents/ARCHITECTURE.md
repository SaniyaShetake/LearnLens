# Architecture Diagrams

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS (`.node-version`, `engines.node >= 24`) |
| Server | Express 4.22, Passport 0.7 (`passport-local`, `passport-jwt`), jsonwebtoken 9 (HS256), bcrypt 6, express-rate-limit 8, Handlebars (`hbs`) for the reset-password pages, in-house CSRF middleware |
| Database | MongoDB (6.0/7.0 tested) via Mongoose 8 / MongoDB driver 6; express-session store: connect-mongo 6 |
| Integrations | YouTube Data API v3 (`fetch`, page-scrape fallback without `GOOGLE_API_KEY`), Mailgun (`mailgun.js`), ExcelJS exports |
| Client | React 17 + React Router 5, built with Vite (`client/`, dev server on :8080 proxying `/api/`) |
| Tests / CI | Jest 30 + supertest (backend), Playwright (e2e, `e2e/`), GitHub Actions (`.github/workflows/ci.yml`) |
| Deploy | PM2 (`ecosystem.config.js`) behind nginx |


## System context

```mermaid
flowchart LR
  Teacher[Teacher Browser]
  Student[Student Browser]
  Researcher[Researcher Browser]
  Express[Express server.js]
  Mongo[(MongoDB)]
  YT[YouTube Data API]
  MG[Mailgun]
  YTEmbed[YouTube Embed]

  Teacher --> Express
  Student --> Express
  Researcher --> Express
  Student --> YTEmbed
  Teacher --> YTEmbed
  Express --> Mongo
  Express --> YT
  Express --> MG
```

## Request path (authenticated teacher)

```mermaid
sequenceDiagram
  participant C as React client
  participant A as Auth provider
  participant E as Express /api
  participant P as Passport JWT
  participant Ctrl as Controller
  participant DB as MongoDB

  C->>A: request(GET, url)
  A->>A: Attach Bearer JWT + credentials
  A->>E: HTTP + cookie debe_token
  E->>P: verifyMiddleware
  P->>DB: User.findOne(_id)
  P-->>E: req.user
  E->>Ctrl: handler
  Ctrl->>DB: queries
  DB-->>Ctrl: docs
  Ctrl-->>C: JSON
```

## Feedback analysis pipeline

```mermaid
flowchart TD
  FB[(feedback docs)] --> Group[Group by student_id]
  Group --> Sec[studentSecondArray]
  Sec --> Min[generateStudentMinuteData]
  Min --> Class[generateClassFeedback]
  Class --> MW[generateMovingWindowAnalysis]
  MW --> Net[generateNetDistribution]
  MW --> Pct[generatePercentageFeedback]
  Class --> Click[generateClickDistribution]
  Min --> Over[generateOverlappingData]
  Class --> Venn[generateVennFeedback]
  Venn --> Charts[venn / radial / participation / detailed]
  Net --> LineChart[Line chart series]
  Click --> Gauge[Click distribution]
```
