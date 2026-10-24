# Tcherly e2e (Playwright)

Black-box end-to-end tests: the app is driven only through the browser and HTTP.
Self-contained package — nothing here imports application code. The only direct
database access is `global-setup.ts`, which seeds a researcher account (there is
no researcher signup in the app).

## Requirements

- Node 24 (24.13.0) for Playwright, the client build (Vite) and the server. With `fnm` installed,
  `scripts/start-server.sh` runs the build/server under `E2E_CLIENT_NODE` / `E2E_SERVER_NODE`
  (both default `v24.13.0`); without `fnm` (e.g. CI) it uses the `node`/`yarn` on `PATH`.
- MongoDB reachable at `mongodb://127.0.0.1:27018` (db `tcherly_e2e`), e.g. the test docker container.
- Chromium revision 1243 in `~/.cache/ms-playwright` (bundled with `@playwright/test@1.63.0`;
  otherwise `npx playwright install chromium`).
- Network access to YouTube (lesson creation fetches video metadata; the student test plays the video).
  If metadata can't be fetched, the lesson-dependent tests are skipped with the reason.

## Run

```sh
cd e2e
fnm exec --using=v24.13.0 -- npm ci
E2E_BUILD=1 fnm exec --using=v24.13.0 -- npx playwright test --project=chromium --workers=1
```

`E2E_BUILD=1` rebuilds `client/` first (`yarn build` = `vite build`, Node `E2E_CLIENT_NODE`); without it the existing `client/build` is used
(and built only if missing). The `webServer` in `playwright.config.ts` starts `node server.js` in
production mode on port 3200 via `scripts/start-server.sh`, with `MAIL_TRANSPORT=log`,
`RATE_LIMIT_DISABLED=true`, test JWT/session secrets and a dummy Mailgun key (no real mail).
Server stdout/stderr go to `e2e/.server.log`; `tests/helpers.ts` reads the `[mail]` lines from it
to extract password-reset links.

Reports: `npx playwright show-report` (screenshots on failure, trace on first retry).

Env overrides: `E2E_PORT`, `E2E_DB_URI`, `E2E_SERVER_LOG`, `E2E_YT_URL`, `E2E_SERVER_NODE` (server Node,
default `v24.13.0`; old name `E2E_NODE_VERSION` still works), `E2E_CLIENT_NODE` (client build Node, default `v24.13.0`).

## Specs

| file | journey |
|---|---|
| 01-landing | landing loads without console errors; Login/Signup links |
| 02-teacher-auth | signup → dashboard → logout → login; bad password; `/dashboard` logged-out → `/login` |
| 03-course-lesson | create course, add YouTube lesson, edit course, lesson dashboard bookmark/question/action (persisted), delete lesson |
| 04-student-feedback | student registers on `/l/<slug>`, plays + skips video, sends Difficult/Easy/Boring/Engaging with sub-reasons; teacher sees participation; teacher is refused the export; researcher downloads the `.xlsx` (PK zip) |
| 05-security | cross-teacher DELETE/PUT refused; spoofed `Host` not used in reset links; reset link single-use; `{"$ne":null}` email sends no mail; no CORS for foreign origins; public lesson JSON has no bookmark questions/actions |
| 06-password-reset-ui | forgot password → link from mail log → new password → login; reset page accepts `-` in passwords |
| 07-error-states | unknown course → friendly error; unknown route → 404 page; unknown API → JSON 404 |
| 08-session | reload / new tab keeps the teacher logged in (refresh cookie) |
| 09-venn | seeded overlapping student feedback → Venn diagrams on the lesson dashboard render correct counts, tooltip, view switch |
| 10-guidelines | reveal.js slides load (4 slides, images), keyboard and control navigation |
| 11-route-sweep | every App route logged out and logged in: redirects, no page errors, no failed chunk/asset loads |
