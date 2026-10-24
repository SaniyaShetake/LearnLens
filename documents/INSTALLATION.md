# Tcherly Installation Guide

This guide walks you through setting up **Tcherly** (DEBE) locally for development or production.

---

## Prerequisites

Before starting, verify you have the required runtimes and tools installed:

1. **Node.js**:
   - **Required**: Node.js **24 LTS** (`.node-version` pins `24`; `package.json` has `engines.node >= 24` for both backend and client).
   - With fnm/nvm: `fnm install 24 && fnm use` (or `nvm install 24 && nvm use 24`).
   - Verify: `node -v` → `v24.x`. If you switch Node versions after installing, delete `node_modules` and reinstall so the native `bcrypt` module matches.
2. **Yarn** (Classic v1.x):
   ```bash
   npm install --global yarn
   yarn -v
   ```
3. **MongoDB** (6.0+ recommended):
   - **Docker (simplest)**: `docker run -d --name tcherly-mongo -p 127.0.0.1:27017:27017 -v tcherly-mongo-data:/data/db mongo:7`
   - **macOS (Homebrew)**: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
   - **Linux (Ubuntu/Debian)**: Follow the [MongoDB Community Edition on Linux](https://www.mongodb.com/docs/manual/administration/install-on-linux/) guide.
   - **Windows**: Download and install the [MongoDB Community Server](https://www.mongodb.com/try/download/community).
   - Alternatively, use a hosted MongoDB instance (e.g., [MongoDB Atlas](https://www.mongodb.com/atlas/database)).

---

## Getting Started

### 1. Clone the Repository

Clone the repository to your local workspace:

```bash
# Via SSH:
git clone git@github.com:IITB-EdTech/tcherly.git
cd tcherly

# Or via HTTPS:
git clone https://github.com/IITB-EdTech/tcherly.git
cd tcherly
```

### 2. Install Dependencies

Install root backend dependencies, followed by client frontend dependencies:

```bash
# 1. Install root dependencies
yarn

# 2. Install client dependencies (runs `cd client && yarn`)
yarn install:c
```

### 3. Configure Environment Variables

Both the backend server and frontend client require `.env` configuration files.

#### Backend (`.env` in project root)
```bash
cp .env.example .env
```
Key variables to verify:
- `PORT`: Server port (default: `3000`).
- `DB_URI`: MongoDB connection string (`"mongodb://localhost:27017/debe"` in `.env.example`, falling back to `"mongodb://localhost:27017/test-debe"` if unset).
- `JWT_SECRET`: Secret key for signing JSON Web Tokens (**required, at least 32 characters**).
- `SESSION_SECRET`: Secret key for the session cookie and CSRF tokens (**required, at least 32 characters**).
  Generate both with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `APP_URL`: Public base URL used in password-reset links (defaults to `http://localhost:3000` outside production).
- `CORS_ORIGINS`: Origins allowed to call the API cross-origin (default outside production: `http://localhost:8080,http://localhost:3000`).
- `GOOGLE_API_KEY`: *(Optional in dev)* Google YouTube API Key to fetch lecture durations automatically during lesson creation.
- `MG_APIKEY` & `MG_DOMAIN`: *(Optional in dev)* Mailgun credentials for sending password-reset emails. Without them (or with `MAIL_TRANSPORT=log`) mails are printed to the server console with a `[mail]` prefix.

#### Frontend (`client/.env`)
```bash
cp client/.env.example client/.env
```
Key variables (Vite; only used by the dev server, production builds always call `/api/`):
- `VITE_API_URL`: API base URL for desktop browsers (`.env.example`: `"http://localhost:3000/api/"`). Leave empty to use the dev-server proxy.
- `VITE_MOBILE_API_URL`: API base URL when testing on a phone on the LAN (e.g. `"http://192.168.1.10:3000/api/"`).
- `VITE_PROXY_TARGET`: backend for the dev-server proxy (default `http://localhost:3000`).

The dev server always runs on port `8080`. The old `REACT_APP_*`, `PORT` and `SKIP_PREFLIGHT_CHECK` variables are no longer used.

> For a complete breakdown of all configuration parameters, see [ENVIRONMENT.md](ENVIRONMENT.md).

---

## Running the Application

### Development Mode

Run both the Express backend and the Vite dev server concurrently:

```bash
yarn dev
```

- **Frontend Client** (Vite, hot reload): [http://localhost:8080](http://localhost:8080) — proxies `/api/` and the
  server-rendered reset-password pages (`/password/reset/:token`, `/student/password/reset/:token`) to the backend.
- **Backend API**: [http://localhost:3000](http://localhost:3000)

Alternatively, run them in separate terminal windows:
- Backend only: `yarn dev:s` (with nodemon live-reloading)
- Frontend only: `yarn dev:c` (`cd client && yarn dev`)

### Production Mode

To test a production build locally:

```bash
yarn build
yarn start
```
Or use the combined shortcut:
```bash
yarn serve
```
In production, Express serves both API endpoints and the compiled React static bundle from `client/build` on port `3000`.
`yarn start` sets `NODE_ENV=production`, which requires `APP_URL` and (for mail delivery) Mailgun settings; for a
quick local check without Mailgun add `MAIL_TRANSPORT=log`.

---

## Testing

### Backend tests (Jest + supertest)

```bash
docker run -d --name tcherly-test-mongo -p 127.0.0.1:27018:27017 mongo:7   # once
yarn test          # = jest --runInBand
```

The suite talks to MongoDB at `mongodb://127.0.0.1:27018` and uses a fresh database per run
(`tcherly_test_jest_<pid>`, dropped afterwards); test secrets and `NODE_ENV=test` are set in
`tests/setup/env.js`, so no `.env` is needed. Mail and YouTube are mocked.

### End-to-end tests (Playwright)

```bash
cd e2e
npm ci
npx playwright install chromium   # once
E2E_BUILD=1 npx playwright test --project=chromium --workers=1
```

This builds the client, starts `node server.js` in production mode on port 3200 against the
`tcherly_e2e` database on the same MongoDB (27018) and drives Chromium. See [`e2e/README.md`](../e2e/README.md).

### CI

`.github/workflows/ci.yml` runs on every push/PR with Node 24 and a MongoDB service: backend + client
install (`--frozen-lockfile`), `yarn test`, `yarn build` in `client/`, then the Playwright suite
(report uploaded on failure).

---

## Post-Installation Steps

### 1. Create a Researcher Account (CLI)

Researchers cannot register through the web UI and must be provisioned via the command line:

```bash
yarn generate --name "Admin Researcher" --email researcher@example.com --pass "securePassword123"
```

To remove a researcher account:
```bash
yarn generate --email researcher@example.com --remove
```

### 2. Existing Database? Run the Slug Migration

When pointing a new release at an existing database, check lesson slugs first (dry run, then apply after a backup):

```bash
yarn migrate:slugs
yarn migrate:slugs --apply
```

See [DEPLOYMENT.md](DEPLOYMENT.md#4a-pre-deploy-lesson-slug-migration-existing-databases) and, when upgrading an
old installation, [Upgrading from the old version](DEPLOYMENT.md#upgrading-from-the-old-version-node-16--mongoose-5).

### 3. Teacher & Student Accounts

- **Teachers**: Register via the web UI at [http://localhost:8080/register](http://localhost:8080/register).
- **Students**: Prompted to register or log in when accessing a shared lesson link (`/l/:lesson_id`).

---

## Troubleshooting

- **MongoDB Connection Error (`MongoNetworkError: failed to connect to server`)**:
  Ensure MongoDB service is actively running (`brew services list` or `sudo systemctl status mongod`) and matches `DB_URI` in `.env`.
- **`The engine "node" is incompatible with this module` on `yarn`**:
  You are on Node < 24. Switch to Node 24 (`fnm use`) and reinstall.
- **`[config] Environment variable JWT_SECRET is missing or too short`**:
  Set `JWT_SECRET` and `SESSION_SECRET` (32+ characters) in `.env`.
- **`Failed to start server: could not connect to MongoDB at startup`**:
  The server exits (code 1) when MongoDB isn't reachable within `DB_CONNECT_TIMEOUT` ms. Start MongoDB or fix `DB_URI`.
- **`Port 8080 is already in use`** from Vite: the dev port is fixed (`strictPort`); stop the other process.
- **Lesson creation fails**:
  Without `GOOGLE_API_KEY`, video duration is read from the public YouTube page. If that fails (network/YouTube changes), set a valid YouTube Data API v3 key in `.env`.
- **Port Conflicts**:
  If port `3000` is in use, change `PORT` in `.env` (and `VITE_API_URL` / `VITE_PROXY_TARGET` in `client/.env` to match). The client dev port `8080` is fixed in `client/vite.config.mjs`.

---

## Production Deployment

For complete instructions on deploying to a production Linux server using PM2, Nginx reverse proxy, Let's Encrypt SSL, and automated deployment hooks, refer to [DEPLOYMENT.md](DEPLOYMENT.md).

