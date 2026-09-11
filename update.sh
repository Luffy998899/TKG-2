#!/usr/bin/env bash
#
# TKG Ventures - ship a change.
#
#   sudo ./update.sh
#
# Rebuilds the site from the source in this directory and restarts it. Run it
# after editing content, after pulling new code, or after changing a value in
# /etc/tkg-ventures.env.
#
# THE IMPORTANT PROPERTY: the new build is made BEFORE the running site is
# touched. If the build fails, the old version keeps serving and this script
# stops with the error. A broken change cannot take the site down.
#
# Your submissions, uploads and /admin settings live outside this directory
# and are never touched.
#
# First-time setup on a new server is ./deploy.sh instead.

set -euo pipefail

APP_NAME="tkg-ventures"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="/etc/${APP_NAME}.env"
SERVICE_USER="tkg"

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$BLUE" "$RESET" "$BOLD" "$1" "$RESET"; }
ok()   { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
note() { printf '    %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
die()  { printf '\n%sError:%s %s\n\n' "$RED" "$RESET" "$1" >&2; exit 1; }

# ------------------------------------------------------------- preflight ----

[ "$(id -u)" -eq 0 ] || die "Run this with sudo:  sudo ./update.sh"
[ -f "$ENV_FILE" ] || die "$ENV_FILE is missing. This server has not been set up - run ./deploy.sh first."
[ -f "$APP_DIR/package.json" ] || die "No package.json in $APP_DIR."

set -a; . "$ENV_FILE"; set +a
PORT="${PORT:-3000}"

printf '\n%s%s update%s\n' "$BOLD" "$APP_NAME" "$RESET"
note "Source: $APP_DIR"
note "Site:   ${NEXT_PUBLIC_SITE_URL:-unset}"

# ------------------------------------------------------------------ pull ----

if [ -d "$APP_DIR/.git" ]; then
  step "Fetching the latest code"
  BEFORE="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if git -C "$APP_DIR" pull --ff-only; then
    AFTER="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    if [ "$BEFORE" = "$AFTER" ]; then
      ok "already up to date ($AFTER)"
    else
      ok "$BEFORE -> $AFTER"
    fi
  else
    warn "git pull failed. Building whatever is on disk instead."
  fi
else
  note "Not a git checkout - building the files as they are on disk."
fi

# ----------------------------------------------------------------- build ----
#
# Everything up to and including the build happens while the old version is
# still serving traffic.

step "Installing dependencies"
cd "$APP_DIR"
# --include=dev: the env file sourced above sets NODE_ENV=production, which
# would otherwise make npm skip TypeScript, Tailwind and PostCSS and fail the
# build immediately.
npm ci --include=dev --no-audit --no-fund
ok "dependencies match package-lock.json"

step "Building"
note "The running site is untouched until this succeeds."
if ! npm run build; then
  die "Build failed. The site is still running the previous version, unchanged."
fi
ok "build succeeded"

step "Staging static assets"
# Not traced into the standalone bundle - see the note in next.config.mjs.
rm -rf "$APP_DIR/.next/standalone/public" "$APP_DIR/.next/standalone/.next/static"
cp -r "$APP_DIR/public" "$APP_DIR/.next/standalone/public"
mkdir -p "$APP_DIR/.next/standalone/.next"
cp -r "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR/.next"
ok "public/ and .next/static staged"

# --------------------------------------------------------------- restart ----

step "Restarting"
systemctl restart "$APP_NAME"

# Give it a moment, then prove it actually came back rather than assuming so.
HEALTHY=0
for _ in $(seq 1 20); do
  sleep 1
  if curl -fsS -o /dev/null --max-time 4 "http://127.0.0.1:${PORT}/"; then
    HEALTHY=1
    break
  fi
done

if [ "$HEALTHY" -ne 1 ]; then
  printf '\n'
  journalctl -u "$APP_NAME" -n 40 --no-pager || true
  die "The site did not answer on port $PORT after restarting. The log above says why."
fi

ok "answering on port $PORT"

# A page that renders through the whole stack, not just the health of the
# process: if a config change broke a page, this is where it shows.
if curl -fsS -o /dev/null --max-time 8 "http://127.0.0.1:${PORT}/services/telecommunications"; then
  ok "pages rendering"
else
  warn "The homepage answered but /services/telecommunications did not. Check the log."
fi

# ------------------------------------------------------------------ done ----

cat <<DONE

  ${GREEN}${BOLD}Updated.${RESET}  ${NEXT_PUBLIC_SITE_URL:-}

    journalctl -u $APP_NAME -f     watch the log
    systemctl status $APP_NAME     check it is running

DONE

if [ -z "${RESEND_API_KEY:-}" ]; then
  warn "No RESEND_API_KEY in $ENV_FILE: inquiries are saved and logged, not emailed."
  printf '\n'
fi
