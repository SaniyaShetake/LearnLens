#!/usr/bin/env bash
# Starts the Tcherly server (production mode) for the e2e suite.
# All server stdout/stderr goes to e2e/.server.log so tests can read `[mail]` lines.
#
# Node selection: when `fnm` is installed, E2E_SERVER_NODE / E2E_CLIENT_NODE pick the versions
# (default v24.13.0). Without fnm (e.g. CI with actions/setup-node) the `node`/`yarn` on PATH are used.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$(cd "$E2E_DIR/.." && pwd)"
LOG_FILE="${E2E_SERVER_LOG:-$E2E_DIR/.server.log}"

# Node used to run server.js (E2E_NODE_VERSION is the old name, still honoured).
E2E_SERVER_NODE="${E2E_SERVER_NODE:-${E2E_NODE_VERSION:-v24.13.0}}"
# Node used to build the client (Vite).
E2E_CLIENT_NODE="${E2E_CLIENT_NODE:-v24.13.0}"

# with_node <version> <cmd...>: runs cmd under that Node via fnm, or with the Node on PATH
with_node() {
  local version="$1"
  shift
  if command -v fnm > /dev/null 2>&1; then
    fnm exec --using="$version" -- "$@"
  else
    "$@"
  fi
}

: > "$LOG_FILE"

if ! command -v fnm > /dev/null 2>&1; then
  echo "[e2e] fnm not found, using $(command -v node) ($(node --version))" >> "$LOG_FILE"
fi

# Build the client when requested (E2E_BUILD=1) or when there is no build yet.
if [[ "${E2E_BUILD:-0}" == "1" || ! -f "$APP_DIR/client/build/index.html" ]]; then
  echo "[e2e] building client (vite)$(command -v fnm > /dev/null 2>&1 && echo " with Node $E2E_CLIENT_NODE")" >> "$LOG_FILE"
  (cd "$APP_DIR/client" && with_node "$E2E_CLIENT_NODE" yarn build) >> "$LOG_FILE" 2>&1
fi

cd "$APP_DIR"
if command -v fnm > /dev/null 2>&1; then
  echo "[e2e] starting server with Node $E2E_SERVER_NODE" >> "$LOG_FILE"
  exec fnm exec --using="$E2E_SERVER_NODE" -- node server.js >> "$LOG_FILE" 2>&1
fi
echo "[e2e] starting server with Node $(node --version)" >> "$LOG_FILE"
exec node server.js >> "$LOG_FILE" 2>&1
