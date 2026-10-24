# Environment Variables Reference

This document outlines all environment variables utilized across the backend server and frontend client applications.

---

## 1. Backend Server (`.env`)

The backend reads configuration from `.env` in the root project directory via `config/index.js` and `dotenv`.

| Variable | Type | Default | Description | Required? |
|---|---|---|---|---|
| `HOSTNAME` | String | `localhost` | **Informational only.** Exposed as `config.app.host` but not used for binding: the server always listens on all interfaces on `PORT`. (Many shells export `HOSTNAME` as the machine name, so it is intentionally not used to bind.) | Unused |
| `PORT` | Number | `3000` | Port for the Express server. | Optional |
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production` or `test`). Outside production morgan logs to the console; in `test` no request log file is written and mail is never sent. `yarn start`, `yarn serve` and the pm2 app set `production`; the jest setup sets `test`. | Optional |
| `APP_URL` | String | `http://localhost:${PORT}` (non-production) | Public base URL of the server (no trailing slash), used to build password-reset links. Never derived from the request `Host` header. | **Required in Prod** (startup fails without it) |
| `CORS_ORIGINS` | String (comma-separated) | `http://localhost:8080,http://localhost:3000` outside production; empty in production | Origins allowed to make credentialed cross-origin requests. Other origins get no CORS headers. Set to an empty value to disable CORS entirely. | Optional |
| `TRUST_PROXY` | String | `loopback` | Value for Express `trust proxy`: `loopback`, `true`, `false`, a hop count (e.g. `1`) or comma-separated IPs/subnets. Determines `req.ip` (used for logging and rate limiting) and whether `X-Forwarded-Proto` is honoured for secure cookies. Use the default when nginx runs on the same host; set to the proxy address otherwise. | Optional |
| `RATE_LIMIT_DISABLED` | Boolean | `false` | When `true`, disables rate limiting on sign-in/sign-up/forgot-password endpoints (sign-in: 20 failed attempts / 15 min / IP; sign-up: 20 / 15 min / IP; forgot password: 5 / 15 min / IP). Intended for test suites only. | Optional |
| `MAIL_TRANSPORT` | String | — | Set to `log` to print outgoing emails (to, subject, body — including password-reset links) to the console with a `[mail]` prefix instead of sending them. Outside production mail is also only logged when `NODE_ENV=test` or `MG_APIKEY` is unset. **In production** mail is only logged when `MAIL_TRANSPORT=log` is set explicitly (a warning is printed at startup); without it and without `MG_APIKEY`/`MG_DOMAIN`, an error is printed at startup and emails fail (nothing is logged). | Optional |
| `DB_CONNECT_TIMEOUT` | Number | `10000` | MongoDB server selection timeout in ms. If the database is unreachable at startup the server logs the error and exits with code 1. | Optional |
| `DB_URI` | String | `mongodb://localhost:27017/test-debe` (`debe` in `.env.example`) | MongoDB connection URI for local or remote database. Falls back to `test-debe` when unset. | Optional (Required in Prod) |
| `DB_PROD` | String | — | **Not read by the code.** To use Atlas/production, put the connection string in `DB_URI`. | Unused |
| `SESSION_EXPIRATION` | Number | `604800000` (7 days) | Express session duration in milliseconds. | Optional |
| `SESSION_SECRET` | String | — | Secret used to sign session cookies. Must be at least 32 characters; the server refuses to start otherwise. | **Required** |
| `JWT_EXPIRY` | Number | `3600000` (1 hour) | Access token expiration lifetime in milliseconds (converted to seconds when signing). | Optional |
| `JWT_REFRESH_EXPIRY` | Number | `2592000000` (30 days) | Refresh token expiration lifetime in milliseconds. | Optional |
| `JWT_SECRET` | String | — | Secret used to sign/verify access tokens. Must be at least 32 characters; the server refuses to start otherwise. | **Required** |
| `GOOGLE_API_KEY` | String | — | Google API key with YouTube Data API v3 enabled. Used when creating/editing a lesson to fetch the video length (`videos?part=snippet,contentDetails`, 15 s timeout). If unset (or still the `<...>` placeholder), the duration is read from the public YouTube page instead. | Optional (recommended in prod) |
| `MG_APIKEY` | String | — | Mailgun API Key. Required (with `MG_DOMAIN`) to deliver password-reset emails in production. Outside production, when unset, emails are logged to the console instead. | Required in production |
| `MG_DOMAIN` | String | — | Mailgun sending domain for outgoing transactional emails. | Required in production |
| `MG_URL` | String | `https://api.mailgun.net` | Mailgun API base URL. Set to `https://api.eu.mailgun.net` for domains in Mailgun's EU region. | Optional |
| `DEPLOYMENT_HOST` | String | — | SSH host/IP address for PM2 production deployment (`ecosystem.config.js`). | Optional |
| `DEPLOYMENT_USER` | String | — | SSH user for PM2 production deployment. | Optional |
| `DEPLOYMENT_KEY` | String | — | Path to SSH private key for PM2 deployment. | Optional |

---

## 2. Frontend Client (`client/.env`)

The client is built with **Vite**. Only `VITE_`-prefixed variables are exposed to browser code
(`import.meta.env.VITE_*`); they only matter for the development server — production builds always
call the same-origin `/api/`. The old Create React App variables (`REACT_APP_API_URL`,
`REACT_APP_MOBILE_API_URL`, `PORT`, `SKIP_PREFLIGHT_CHECK`) are no longer read.

| Variable | Type | Default | Description | Required? |
|---|---|---|---|---|
| `VITE_API_URL` | String | `/api/` | API base URL used by desktop browsers in development. `.env.example` sets `http://localhost:3000/api/` (direct CORS calls; the backend's default `CORS_ORIGINS` allows `http://localhost:8080`). Leave empty to go through the dev-server proxy instead (same-origin cookies). | Optional |
| `VITE_MOBILE_API_URL` | String | falls back to `VITE_API_URL` | API base URL used when the dev site is opened on a phone/tablet on the LAN, e.g. `http://192.168.1.10:3000/api/`. | Optional |
| `VITE_PROXY_TARGET` | String | `http://localhost:3000` | Backend the Vite dev server proxies `/api/` and the reset-password pages to (read by `vite.config.mjs`, not exposed to the browser). | Optional |

The dev server port is fixed to **8080** (`strictPort`) in `client/vite.config.mjs`.

---

## Setup Instructions

Create the environment files from the provided templates:

```bash
# Root backend configuration
cp .env.example .env

# Frontend configuration
cp client/.env.example client/.env
```
