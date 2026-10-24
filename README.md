# Tcherly

> *Online student-feedback tool for improving lecture teaching practice.*

Tcherly (formerly **DEBE** — *Difficult, Easy, Boring, Engaging*) helps educators collect **high-resolution, in-lecture student feedback** and turn it into actionable pedagogical interventions. Developed from educational technology research at **IDP-ET, IIT Bombay**, Tcherly addresses the latency and coarseness of traditional end-of-semester surveys by providing real-time, minute-by-minute formative feedback during video lectures.

Live deployment: [https://www.tcherly.com](https://www.tcherly.com)

---

## Table of Contents

- [Overview & Core Loop](#overview--core-loop)
- [Tech Stack](#tech-stack)
- [Architecture & Diagrams](#architecture--diagrams)
- [Screenshots](#screenshots)
- [Installation & Setup](#installation--setup)
- [Available Commands](#available-commands)
- [Testing](#testing)
- [Upgrading from the old version](#upgrading-from-the-old-version)
- [Documentation](#documentation)

---

## Overview & Core Loop

```
Teacher creates Lesson (YouTube video)
        │
        ▼  Shares /l/<slug> link with students
Students watch video and submit real-time reactions at any timestamp:
        Difficult · Easy · Boring · Engaging  (+ optional sub-reasons)
        │
        ▼  Clicks stored with video timestamps
Teacher reviews Lesson Dashboard:
        Line charts · Venn diagrams · Radial charts · Participation · Detailed sub-reasons
        │
        ▼  Scrubs timeline to locate moments of difficulty or drop in engagement
Bookmark ──► Question ("Why did engagement drop at min 12?") ──► Action ("Add worked example")
        │
        ▼
Pedagogical intervention applied to future lectures
```

---

## Tech Stack

| Area | Technologies |
|---|---|
| **Backend** | Node.js 24 LTS, Express 4, Passport 0.7 (Local & JWT), jsonwebtoken 9, bcrypt 6, express-rate-limit, Handlebars (`hbs`) |
| **Frontend** | React 17 built with Vite (`client/`), React Router 5, Bootstrap 4 / react-bootstrap, Formik + Yup |
| **Database** | MongoDB via Mongoose 8, session store with connect-mongo 6 |
| **Data Visualization** | Recharts, D3, `@upsetjs/venn.js`, Custom SVG radial heatmaps |
| **Integrations** | `react-player` (YouTube embed), YouTube Data API v3, Mailgun (`mailgun.js`), ExcelJS |
| **Tooling & Deploy** | Yarn 1, nodemon, concurrently, Jest + supertest, Playwright, GitHub Actions, PM2 (`ecosystem.config.js`) |

---

## Architecture & Diagrams

Comprehensive architectural specifications and system diagrams are documented in dedicated guides:

- **[System Architecture](documents/ARCHITECTURE.md)** — High-level system context diagram, authenticated request flows, and feedback analysis pipeline overview.
- **[Data Flow Diagrams](documents/DATA_FLOW.md)** — Detailed sequence and flow diagrams covering student feedback capture (write path), teacher dashboard rendering (read path), pipeline internals, three-identity auth model, and Excel export.
- **[Entity Relationship Diagram](documents/ER_DIAGRAM.md)** — Complete Mongoose schema relationships across all 13 models (`User`, `Student`, `Researcher`, `Course`, `Lesson`, `Feedback`, `Bookmark`, `Log`, etc.).

---

## Screenshots

> Captured from the live platform at [tcherly.com](https://www.tcherly.com).

### 1. Landing Page
![Landing page hero](screenshots/01-home.png)
*Home: Product introduction and "Get Started" entry into signup.*

### 2. Teacher Login
![Login form](screenshots/02-login.png)
*Teacher authentication with email/password and password recovery.*

### 3. Registration Mode Selection
![Signup mode selection](screenshots/03-register.png)
*Registration selection: Classroom Feedback (upcoming) or Online Feedback.*

### 4. Online Feedback Registration
![Online registration form](screenshots/05-signup-online.png)
*Signup form capturing institution, mode, feature tier, and research consent.*

### 5. Research Background
![Research page](screenshots/04-research.png)
*Background: Pedagogical context and problem statement for in-lecture formative feedback.*

---

## Installation & Setup

### Prerequisites

Ensure you have the following installed:

1. **[Node.js](https://nodejs.org/)**:
   - **Required: Node.js 24 LTS** (pinned in `.node-version`; `fnm use` / `nvm use 24` picks it up; `engines.node >= 24`).
   - If you switch Node versions after installing, delete `node_modules` (and `client/node_modules`) and reinstall so the native `bcrypt` module matches.
2. **[Yarn](https://classic.yarnpkg.com/en/docs/install/)** (v1.x):
   ```bash
   npm install --global yarn
   ```
3. **[MongoDB](https://www.mongodb.com/)** (6.0+ recommended) running locally (`mongodb://localhost:27017/debe` in `.env.example`, falling back to `mongodb://localhost:27017/test-debe`) or via a remote connection string.
   - No local install? Run it with Docker: `docker run -d --name tcherly-mongo -p 127.0.0.1:27017:27017 -v tcherly-mongo-data:/data/db mongo:7`

### Step-by-step Setup

1. **Clone the repository:**
   ```bash
   # Via SSH:
   git clone git@github.com:IITB-EdTech/tcherly.git
   cd tcherly

   # Or via HTTPS:
   git clone https://github.com/IITB-EdTech/tcherly.git
   cd tcherly
   ```

2. **Install server and client dependencies:**
   ```bash
   yarn
   yarn install:c
   ```

3. **Configure environment variables:**
   - Copy root backend `.env`:
     ```bash
     cp .env.example .env
     ```
   - Copy client `.env`:
     ```bash
     cp client/.env.example client/.env
     ```
   - Set `JWT_SECRET` and `SESSION_SECRET` (required, **at least 32 characters** each — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), review the MongoDB URI and the optional YouTube/Mailgun keys (see [ENVIRONMENT.md](documents/ENVIRONMENT.md)).
   - The client uses Vite: `VITE_API_URL` / `VITE_MOBILE_API_URL` (development only) replace the old `REACT_APP_*` variables.

4. **Start the development servers:**
   ```bash
   yarn dev
   ```
   - Frontend UI (Vite dev server, proxies `/api/` to the backend): [http://localhost:8080](http://localhost:8080)
   - Backend API (nodemon): [http://localhost:3000](http://localhost:3000)

For comprehensive setup options, production deployment, troubleshooting, and CLI researcher seeding, see [INSTALLATION.md](documents/INSTALLATION.md).

---

## Available Commands

| Command | Description | Notes |
|---|---|---|
| `yarn dev` | Starts both server and client development servers concurrently | Backend: `http://localhost:3000`, Client: `http://localhost:8080` |
| `yarn dev:s` | Starts backend development server with `nodemon` | Restarts automatically on file changes |
| `yarn dev:c` | Starts the frontend Vite dev server | Port 8080, proxies `/api/` |
| `yarn install:c` | Installs client-specific dependencies in `client/` | Shortcut for `cd client && yarn` |
| `yarn build` | Builds the React frontend for production (`vite build`) | Outputs static bundle to `client/build` |
| `yarn serve` | Builds the client and starts the production server | Sets `NODE_ENV=production` |
| `yarn deploy` | Deploys using PM2 | Uses `ecosystem.config.js` |
| `yarn generate` | Seeds researcher accounts via CLI | Run `yarn generate --help` for usage |
| `yarn migrate:slugs` | Checks lesson slugs (dry run); `--apply` fixes them | Run before deploying to an existing database |
| `yarn test` | Backend test suite (Jest + supertest) | Needs MongoDB on `127.0.0.1:27018` |

---

## Testing

```bash
# Backend (Jest): MongoDB on 127.0.0.1:27018, one throw-away database per run
docker run -d --name tcherly-test-mongo -p 127.0.0.1:27018:27017 mongo:7
yarn test

# End-to-end (Playwright, Chromium): builds the client and starts the server on :3200
cd e2e && npm ci && npx playwright install chromium
E2E_BUILD=1 npx playwright test --project=chromium --workers=1
```

GitHub Actions (`.github/workflows/ci.yml`) runs both on every push and pull request (Node 24, MongoDB service).
Details: [INSTALLATION.md → Testing](documents/INSTALLATION.md#testing) and [`e2e/README.md`](e2e/README.md).

---

## Upgrading from the old version

The backend now requires **Node 24** (was Node 16) and all dependencies were upgraded (Mongoose 8, Express 4.22,
Passport 0.7, jsonwebtoken 9, bcrypt 6, ...); the client moved from Create React App to Vite. Before deploying:

- Install Node 24 and reinstall `node_modules` (backend and client).
- Back up the database and run `yarn migrate:slugs` (then `--apply`).
- `JWT_SECRET` / `SESSION_SECRET` must be at least 32 characters; set `APP_URL` in production.
- Existing access tokens become invalid: users are refreshed silently or sign in again.
- Mail must be configured in production (`MG_APIKEY`, `MG_DOMAIN`, optional `MG_URL` for EU).
- Rename `REACT_APP_API_URL` / `REACT_APP_MOBILE_API_URL` to `VITE_API_URL` / `VITE_MOBILE_API_URL` in `client/.env`.

Full checklist: [DEPLOYMENT.md → Upgrading from the old version](documents/DEPLOYMENT.md#upgrading-from-the-old-version-node-16--mongoose-5).

---

## Documentation

- **[INSTALLATION.md](documents/INSTALLATION.md)** — Detailed setup prerequisites and instructions.
- **[DEPLOYMENT.md](documents/DEPLOYMENT.md)** — Production deployment guide with PM2, Nginx, and SSL setup.
- **[ENVIRONMENT.md](documents/ENVIRONMENT.md)** — Comprehensive environment variable configuration reference.
- **[OVERVIEW.md](documents/OVERVIEW.md)** — Deep-dive system architecture, actors, feature map, and pipeline mechanics.
- **[ARCHITECTURE.md](documents/ARCHITECTURE.md)** — Mermaid diagrams of system context and analysis pipeline.
- **[DATA_FLOW.md](documents/DATA_FLOW.md)** — In-depth sequence and flow diagrams for data transactions.
- **[ER_DIAGRAM.md](documents/ER_DIAGRAM.md)** — Database schema and entity relationships.
- **[FEEDBACK.md](documents/FEEDBACK.md)** — Notes on feedback classification and interaction models.
- **[NOTES.md](documents/NOTES.md)** — Developer notes: security limitations, dependency/runtime decisions (Express 5, sanitizeFilter, CSRF).
- **[LIST.md](documents/LIST.md)** — Project checklist and feature items.