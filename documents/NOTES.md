# TODO:

- [x] Add basic and advanced options to registration form
- [x] Add labels on axes
- [x] Venn Diagram changes
- [x] Venn diagram natural color intersection
- [ ] Header for venn diagram sections (pending content)
- [x] Bookmark, allow selection of all four options
- [ ] Radial column chart
  - [ ] Shift filter threshold from radial column chart to between bottom of line chart & line checkboxes
    - [ ] Reduce size of checkboxes and text size
  - [x] Delete threshold circle from the radial column chart
  - [x] Instead of n=x written with each feedback click percentage, make it n percentage
    - [x] Should we keep hover over feature here? mean if they hover over the % of clicks box the pop-up will show ‘Percentage of clicks’ and ‘Percentage of students’ for the other box
    - [x] Keep font size of click percentages larger as compared to student percentages
  - [ ] Header for radial column chart section
- [x] Question tracker and action tracker: Link quesion generator with action tracker
- [ ] Student feedback interface:
  - [x] Keep 2 options in a row instead of 3 (which we currently have) with which the block sizes will be uniform and too much wrapping of the text can be avoided.
  - [x] After ‘Other’, add one more button in light red colour with the following text in it: No further feedback.

- [x] Filter threshold (urgent)
- [x] Change data for venn diagram venn2, make it serial
- [ ] Navbar changes on landing page & dashboard (remove right padding)
- [x] Radial chart values is not total 100%
- [x] Lesson dashboard open in new tab (lessons page)
- [x] (*) Checkboxes size for line chart selection, lower the size
- [ ] Wrap text in detailed feedback hover
- [x] Reduce spacing between time range on save bookmark field
- [x] Make row width for action tracker & question generator uniform
- [x] Reduce size for video range selector 
# Security notes (known limitations)

- **Refresh tokens are not rotated.** `/api/auth/refresh`, `/api/auth/student/refresh` and
  `/api/auth/researcher/refresh` issue a new access token but keep the same refresh token (one per
  account, stored in an httpOnly cookie) until it expires, the account signs in again, or it logs
  out. A stolen refresh cookie stays usable for its lifetime (1 day, or `JWT_REFRESH_EXPIRY` with
  "remember me"). Logout (`POST /api/auth[/student|/researcher]/logout`) deletes it server-side and
  works without a valid access token.
- **Access tokens outlive a password reset.** A password reset deletes all refresh tokens of the
  account, but access JWTs are stateless: one issued before the reset stays valid until it expires
  (at most `JWT_EXPIRY`, 1 hour by default).
- **CSRF on the reset-password forms** (`middleware/csrf.js`, replaces the archived `csurf`): a random
  secret in the httpOnly, SameSite=Lax `_csrf` cookie plus a hidden `_csrf` form field holding
  `HMAC-SHA256(SESSION_SECRET, secret)`, compared in constant time; mismatches get 403
  `invalid csrf token`. JSON API endpoints use Bearer tokens and are not CSRF-protected.
- **NoSQL operator injection**: `middleware/sanitize.js` strips `$`-prefixed and dotted keys from
  `req.body`, `req.query` and `req.params` before any controller runs, and controllers type-check
  ids/emails. Mongoose's `sanitizeFilter` is deliberately **not** enabled: about 40 server-built
  filters use operators (`$in`, `$gt`, `$lte`, `$exists`/`$ne`, `$or`, ...) that it would wrap in
  `$eq` and silently turn into "match nothing" unless every one were wrapped in `mongoose.trusted()`.
  Revisit if the sanitize middleware is ever removed.
- **Mongoose `strictQuery`** is set explicitly to `false` (`database/index.js`), matching the
  Mongoose 5 behaviour the queries were written for.

# Dependency / runtime notes

- Backend runs on **Node 24 LTS** (`.node-version`, `engines.node >= 24`). CI (`.github/workflows/ci.yml`)
  runs the jest suite, the Vite client build and the Playwright e2e suite on Node 24 with a MongoDB service.
- **Express stays on 4.x**: `middleware/sanitize.js` mutates `req.query` in place, which Express 5 turns into a
  read-only getter. Moving to Express 5 requires changing the sanitizer to build a sanitized copy (e.g.
  `Object.defineProperty(req, "query", { value: sanitized })`) and checking the path syntax changes
  (`/api/*` → `/api/*splat`, `app.get("*")` → `app.get("/*splat")`).
- **Mongoose 8** (the 9.x line is available; upgrade separately after reading its migration guide).
  `mongodb` is a direct dependency only to satisfy connect-mongo's peer dependency; keep its range equal to the
  driver version Mongoose pins (`~6.20.0` for Mongoose 8.24) so only one driver is installed.
- `express-session` + `connect-mongo` are still mounted but no route uses sessions (all Passport strategies
  run with `session: false`); they could be removed in a later cleanup.
- Replaced packages: `csurf` → `middleware/csrf.js`; `mailgun-js` → `mailgun.js` + `form-data`;
  `simple-youtube-api` → direct YouTube Data API v3 call with `fetch`; `crypto-random-string` → `utils/random.js`;
  `uuid` → `crypto.randomUUID()`; `date-fns` → a date comparison; `arg`/`chalk`/`yup` (researcher CLI) →
  `util.parseArgs`/`util.styleText`/plain validation. `pug` and root `sass` were unused and removed.
- `package.json` `resolutions` pin patched transitive versions: `exceljs/uuid` (exceljs only calls `v4()`),
  `pm2/js-yaml` (patch release). Drop them once exceljs/pm2 ship the fixes.
