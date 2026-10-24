# Tcherly Deployment Guide

This guide covers deploying **Tcherly** (DEBE) to a production Linux server (e.g., Ubuntu 20.04 / 22.04 LTS) using **PM2**, **Nginx**, and **Certbot (SSL)**.

---

## Table of Contents

- [Production Architecture](#production-architecture)
- [Server Requirements](#server-requirements)
- [Method 1: Manual Production Installation](#method-1-manual-production-installation)
  - [1. Server Prerequisites](#1-server-prerequisites)
  - [2. Clone & Install Dependencies](#2-clone--install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Build the Frontend](#4-build-the-frontend)
  - [5. Process Management with PM2](#5-process-management-with-pm2)
  - [6. Configure Nginx Reverse Proxy & SSL](#6-configure-nginx-reverse-proxy--ssl)
- [Method 2: Automated Deployment via PM2 Deploy](#method-2-automated-deployment-via-pm2-deploy)
- [Upgrading from the old version (Node 16 / Mongoose 5)](#upgrading-from-the-old-version-node-16--mongoose-5)
- [Database Setup & Backups](#database-setup--backups)
- [Operations & Maintenance](#operations--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Production Architecture

In production, the architecture runs as a unified single-process service behind a reverse proxy:

```
Internet (HTTPS :443)
       │
       ▼
  Nginx (SSL Termination & Reverse Proxy)
       │ (HTTP :3000)
       ▼
 Express Server (`server.js`) managed by PM2
  ├── Static Files (`/` ──► `client/build`)
  ├── SPA Routing (`*` ──► `client/build/index.html`)
  └── REST API (`/api/*` ──► Controllers & Passport Auth)
       │
       ▼
 MongoDB (Local or MongoDB Atlas Cluster)
```

---

## Server Requirements

- **Operating System**: Ubuntu 20.04 LTS / 22.04 LTS, Debian 11+, or similar Linux distribution.
- **Hardware**: Minimum 1 vCPU, 2 GB RAM (at least 1 GB swap recommended if building on a small instance).
- **Node.js**: Node.js **`v24.x` LTS** (`engines.node >= 24` in `package.json`; `.node-version` pins `24`). Older Node versions are not supported (the PM2 post-deploy hook aborts on Node < 24).
- **Process Manager**: PM2.
- **Database**: MongoDB 6.0+ recommended (CI runs against `mongo:7`, the local test container is `mongo:6`), local or managed Atlas cluster. The app uses Mongoose 8 / MongoDB Node driver 6.x; check the driver compatibility table before using an older server.
- **Reverse Proxy**: Nginx with Let's Encrypt SSL certificate.

---

## Method 1: Manual Production Installation

### 1. Server Prerequisites

Connect to your server and install Node.js, Yarn, PM2, and Nginx:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential

# Install Node.js 24 LTS (or use fnm/nvm: `fnm install 24 && fnm default 24`)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install Yarn and PM2 globally
sudo npm install -g yarn pm2

# Verify versions
node -v    # v24.x
yarn -v    # 1.22.x
pm2 -v     # 7.x (the repo's devDependency is pm2 ^7; any recent global pm2 works)
```

No `NODE_OPTIONS=--openssl-legacy-provider` or `SKIP_PREFLIGHT_CHECK` is needed any more: the client
is built with Vite and the backend runs natively on Node 24. `bcrypt` ships prebuilt Node 24
binaries; `build-essential` is only needed if a prebuild is unavailable for your platform.

---

### 2. Clone & Install Dependencies

Clone the repository to the application user's home directory (e.g., `/home/ubuntu/tcherly` or `/var/www/tcherly`):

```bash
cd ~
git clone https://github.com/IITB-EdTech/tcherly.git
cd tcherly

# Install root dependencies (exact versions from yarn.lock)
yarn install --frozen-lockfile

# Install client dependencies (the Vite build needs its devDependencies)
yarn --cwd client install --frozen-lockfile --production=false
```

---

### 3. Configure Environment Variables

Create the production `.env` file in the project root:

```bash
cp .env.example .env
nano .env
```

Set the production values:

```ini
HOSTNAME=0.0.0.0
PORT=3000
NODE_ENV=production

# Public URL (required in production: used in password-reset links)
APP_URL="https://yourdomain.com"
# nginx on the same host → keep the default; otherwise set the proxy address/hop count
TRUST_PROXY=loopback
# Only needed if the API is called cross-origin; same-origin SPA needs no CORS
CORS_ORIGINS=

# Database (local URI or MongoDB Atlas connection string; only DB_URI is read)
DB_URI="mongodb://localhost:27017/debe"
# DB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/debe?retryWrites=true&w=majority"
DB_CONNECT_TIMEOUT=10000

# Security Secrets (MUST be unique random strings of at least 32 characters, or the server refuses to start)
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
SESSION_EXPIRATION=604800000
SESSION_SECRET="generate_a_cryptographically_secure_random_session_secret_here"

JWT_EXPIRY=3600000
JWT_REFRESH_EXPIRY=2592000000
JWT_SECRET="generate_a_cryptographically_secure_random_jwt_secret_here"

# YouTube Data API Key (Required for automatic lecture duration lookup)
GOOGLE_API_KEY="your_google_cloud_api_key_with_youtube_v3_enabled"

# Mailgun Credentials (Required for password-reset emails in production)
MG_APIKEY="your_mailgun_api_key"
MG_DOMAIN="your_mailgun_verified_domain"
# EU-region Mailgun domains only:
# MG_URL="https://api.eu.mailgun.net"
```

Configure the client environment:
```bash
cp client/.env.example client/.env
nano client/.env
```
Production builds always call the same-origin `/api/`, so `client/.env` needs no production values.
`VITE_API_URL` / `VITE_MOBILE_API_URL` only affect the development server (they replace the old
`REACT_APP_API_URL` / `REACT_APP_MOBILE_API_URL`; `SKIP_PREFLIGHT_CHECK` is gone).

---

### 4. Build the Frontend

Compile the React frontend into static production assets (Vite; `yarn build` = `cd client && yarn build` = `vite build`):

```bash
yarn build
```

This generates the static files in `client/build/`, which Express automatically serves when `NODE_ENV=production`.

---

### 4a. Pre-deploy: Lesson Slug Migration (existing databases)

Lesson slugs (`lesson.id`, used in student links `/l/<slug>`) now use a **partial** unique index
(only string slugs are indexed) instead of the old sparse one. Before (re)starting a new release
against an existing database, check for lessons with a missing/`null` slug or duplicated slugs:

```bash
# Dry run: only reports problems, changes nothing (uses DB_URI from .env)
yarn migrate:slugs

# Back up first (see "Database Setup & Backups"), then fix them:
yarn migrate:slugs --apply
```

With `--apply` the script gives slug-less lessons a new slug and, for each duplicated slug, keeps it
on the **oldest** lesson and re-slugs the others. It prints an `old -> new` mapping: student links
using a changed slug stop working, so send the new links to the affected teachers. It also replaces
an outdated `id_1` index with the new partial unique index.

If this step is skipped and conflicting data exists, the server still starts, but logs
`[db] INDEX BUILD FAILED for model "lesson"` at startup and slug uniqueness is not enforced until the
migration is run and the server restarted.

The script is idempotent; running it again when everything is fine reports zero problems.

---

### 5. Process Management with PM2

Use PM2 to manage the application process, handle restarts, and monitor logs.

#### Start Application with PM2:

```bash
pm2 start ecosystem.config.js --env production
```

Alternatively, run directly with PM2:
```bash
pm2 start server.js --name "tcherly" --env NODE_ENV=production
```

#### Configure PM2 Startup on Server Reboot:

```bash
# Generate and configure systemd startup script
pm2 startup

# Follow the on-screen command provided by PM2, e.g.:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save current PM2 processes to resurrect on boot
pm2 save
```

#### Verify Process Status:
```bash
pm2 status
pm2 logs debe --lines 50
```

---

### 6. Configure Nginx Reverse Proxy & SSL

#### 1. Create Nginx Site Configuration:

```bash
sudo nano /etc/nginx/sites-available/tcherly
```

Paste the following configuration (replace `yourdomain.com` with your actual domain name):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Client body limit for file uploads/exports
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running reports or Excel exports
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

#### 2. Enable the Site and Test Configuration:

```bash
sudo ln -s /etc/nginx/sites-available/tcherly /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. Install SSL Certificate with Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot automatically configures HTTPS redirection and certificate renewals.

---

## Method 2: Automated Deployment via PM2 Deploy

The repository includes a built-in PM2 deployment target configured in `ecosystem.config.js`.

### 1. Configure Local Machine `.env`

Add deployment credentials to your local `.env`:

```ini
DEPLOYMENT_HOST="your.server.ip.or.hostname"
DEPLOYMENT_USER="ubuntu"
DEPLOYMENT_KEY="~/.ssh/id_rsa"
```

Ensure your server user has SSH access and Git read permissions for the repository.

### 2. Initial Remote Setup (First Time Only)

Run PM2 deployment setup on your local machine:

```bash
npx pm2 deploy ecosystem.config.js production setup
```

This clones the repository to `~/debe` on the remote server.

### 3. Deploy Updates

When changes are pushed to GitHub `origin/main`, trigger an automated deployment:

```bash
yarn deploy
```

> Run the [lesson slug migration](#4a-pre-deploy-lesson-slug-migration-existing-databases) on the server (dry run, then `--apply`) before the first deploy of this release.

PM2 SSHs into the remote server, pulls the latest commits, and runs the configured post-deploy hook
(`ecosystem.config.js`):
```bash
node -e "<abort unless Node >= 24>" \
  && yarn install --frozen-lockfile \
  && yarn --cwd client install --frozen-lockfile --production=false \
  && yarn build \
  && pm2 startOrRestart ecosystem.config.js --env production --update-env
```
The pm2 app runs `server.js` directly (previously `yarn start`), with `NODE_ENV=production` and the
variables from `.env`. The remote host's default `node` (the one in pm2's non-interactive SSH `PATH`)
must be Node 24.

---

## Upgrading from the old version (Node 16 / Mongoose 5)

This release moves the backend from Node 16 to **Node 24 LTS** and upgrades every dependency
(Mongoose 5 → 8, Express 4.17 → 4.22, jsonwebtoken 9, passport 0.7, bcrypt 6, connect-mongo 6,
mailgun.js, express-rate-limit 8, ...). The client moved from Create React App to Vite. Checklist:

1. **Node 24 on the server** (and in pm2's `PATH`), then a clean install: `rm -rf node_modules client/node_modules`
   and reinstall (native `bcrypt` must match the Node ABI). Run `pm2 update` afterwards so the pm2 daemon itself
   runs on Node 24. **MongoDB 4.2 or newer is required** (MongoDB Node driver 6.x); older servers make the app exit at startup.
2. **Back up the database**, then run the [lesson slug migration](#4a-pre-deploy-lesson-slug-migration-existing-databases)
   (`yarn migrate:slugs`, then `yarn migrate:slugs --apply`) before starting the new release.
3. **Secrets**: `JWT_SECRET` and `SESSION_SECRET` are now required and must be **at least 32 characters**
   (the server refuses to start otherwise, and also rejects the `.env.example` placeholders). Generate new ones.
4. **Old access tokens are invalid**: JWTs signed with the old secret, or without the `type` claim the new
   server requires (`user`/`student`/`researcher`), are rejected with 401 (HS256 only). Clients silently get a new
   token through their refresh-token cookie when it is still valid; otherwise users simply sign in again.
   Announce a possible one-time logout. **Researchers are always logged out once**: their refresh tokens used to be
   stored under the `user` field and are no longer accepted, so they must sign in again.
5. **Mail is required in production**: set `MG_APIKEY` + `MG_DOMAIN` (and `MG_URL` for EU domains). Without them the
   server logs an error at startup and password-reset mails fail. `MAIL_TRANSPORT=log` prints mails to the log instead
   (only for debugging: reset links end up in the log).
6. **New environment variables**: `APP_URL` (required in production), `CORS_ORIGINS`, `TRUST_PROXY`,
   `RATE_LIMIT_DISABLED`, `MAIL_TRANSPORT`, `MG_URL`, `DB_CONNECT_TIMEOUT` — see [ENVIRONMENT.md](ENVIRONMENT.md).
   `DB_PROD` is not read; put the Atlas URI in `DB_URI`.
7. **Client env**: rename `REACT_APP_API_URL` / `REACT_APP_MOBILE_API_URL` to `VITE_API_URL` / `VITE_MOBILE_API_URL`
   in `client/.env` (development only) and drop `SKIP_PREFLIGHT_CHECK`.
8. **Recreate the pm2 app once**: `pm2 startOrRestart` keeps the script of an app that already exists, so the switch from
   `yarn start` to running `server.js` directly only takes effect after
   `pm2 delete debe && pm2 start ecosystem.config.js --env production && pm2 save` on the server (one time).
9. Existing password hashes (`$2b$`/`$2a$`, cost 13) keep working with bcrypt 6; nothing to migrate.
9. The `sessions` collection (express-session via connect-mongo, now 6.x reusing the mongoose connection) is
   not used for authentication (all auth is JWT + refresh-token cookie); old session documents can be left alone.

---

## Database Setup & Backups

### Local MongoDB Setup (Ubuntu)

If running MongoDB directly on the same server:

```bash
sudo apt install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### Automated Database Backups

Schedule regular automated database dumps with a daily cron job:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2:00 AM:
0 2 * * * mongodump --uri="mongodb://localhost:27017/debe" --archive="/var/backups/tcherly_$(date +\%Y\%m\%d).gz" --gzip
```

---

## Operations & Maintenance

### Seed Administrator / Researcher Account

Researchers cannot register through the public UI. Create the initial administrative researcher account on the server:

```bash
cd ~/tcherly
yarn generate --name "Lead Researcher" --email "researcher@yourdomain.com" --pass "StrongPassword123"
```

### Useful PM2 Commands

| Command | Action |
|---|---|
| `pm2 status` | View running processes, CPU, and memory usage |
| `pm2 logs debe` | Stream consolidated server output and error logs |
| `pm2 reload debe` | Zero-downtime reload of the application |
| `pm2 restart debe` | Hard restart of the Express process |
| `pm2 stop debe` | Stop the application |
| `pm2 monit` | Terminal dashboard monitoring system metrics |

### Log Rotation

To prevent logs from consuming unbounded disk space:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## Troubleshooting

1. **Client Shows Blank Page after Deploy**:
   - Check if `client/build/index.html` exists.
   - Verify `yarn build` completed successfully without out-of-memory errors.
   - Ensure `NODE_ENV=production` is passed to the Express process.

2. **502 Bad Gateway from Nginx**:
   - Verify the Express server is running on port 3000: `curl http://127.0.0.1:3000`.
   - Check PM2 status: `pm2 status`.
   - Check PM2 error logs: `pm2 logs debe --err`.

3. **Build Fails with `JavaScript heap out of memory`**:
   - The Vite build needs far less memory than the old CRA/Webpack 4 build, but small instances may still need swap. Add swap if running on a 1GB/2GB instance:
     ```bash
     sudo fallocate -l 2G /swapfile
     sudo chmod 600 /swapfile
     sudo mkswap /swapfile
     sudo swapon /swapfile
     ```
   - Alternatively, run the build with `NODE_OPTIONS=--max-old-space-size=1500 yarn build`.

4. **Mailgun / Password Reset Not Delivering**:
   - Check `MG_APIKEY` and `MG_DOMAIN` in `.env` (and `MG_URL=https://api.eu.mailgun.net` for EU-region domains).
   - Look for `[mail]` lines in `pm2 logs debe`: the startup check reports missing configuration, and delivery failures are logged (without the message body).
   - Verify that your domain DNS records (SPF, DKIM, MX) are active in Mailgun.

5. **Server exits right after start with `Failed to start server: could not connect to MongoDB at startup`**:
   - The server exits with code 1 when MongoDB is unreachable within `DB_CONNECT_TIMEOUT` ms (pm2 restarts it). Check `DB_URI` and that `mongod` is running.

6. **`The engine "node" is incompatible with this module` / `Node >= 24 required`**:
   - The host (or pm2's SSH `PATH`) runs an older Node. Install Node 24 and reinstall `node_modules`.
