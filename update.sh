#!/usr/bin/env bash
#
# TKG Ventures - ship a change.
#
#   sudo ./update.sh
#
# Rebuilds the site from the source in this directory and restarts it, then
# installs or updates the CRM at /crm (crm/scripts/server.sh). Run it after
# editing content, after pulling new code, or after changing a value in
# /etc/tkg-ventures.env or /etc/tkg-crm.env.
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
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

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
SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://tkgventuresltd.ca}"
DOMAIN="${SITE_URL#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"; DOMAIN="${DOMAIN#www.}"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Invalid site domain in $ENV_FILE: $SITE_URL"
SITE_URL="https://$DOMAIN"
export NEXT_PUBLIC_SITE_URL="$SITE_URL"

printf '\n%s%s update%s\n' "$BOLD" "$APP_NAME" "$RESET"
note "Source: $APP_DIR"
note "Site:   ${NEXT_PUBLIC_SITE_URL:-unset}"

# ------------------------------------------------------------------ pull ----

if [ -d "$APP_DIR/.git" ]; then
  step "Fetching the latest code"
  CURRENT_BRANCH="$(git -C "$APP_DIR" branch --show-current)"
  [ "$CURRENT_BRANCH" = "$DEPLOY_BRANCH" ] || die "Expected branch '$DEPLOY_BRANCH', found '${CURRENT_BRANCH:-detached HEAD}'. Check out the intended branch before deploying."
  [ -z "$(git -C "$APP_DIR" status --porcelain)" ] || die "The checkout has uncommitted changes. Commit or safely move them before deploying."
  git -C "$APP_DIR" remote get-url origin >/dev/null 2>&1 || die "Git remote 'origin' is not configured."
  BEFORE="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  git -C "$APP_DIR" fetch --prune origin "$DEPLOY_BRANCH" || die "Could not fetch origin/$DEPLOY_BRANCH; no build was attempted."
  git -C "$APP_DIR" merge --ff-only "origin/$DEPLOY_BRANCH" || die "Cannot fast-forward to origin/$DEPLOY_BRANCH. Resolve branch divergence manually; no build was attempted."
  AFTER="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if [ "$BEFORE" = "$AFTER" ]; then
    ok "already up to date ($AFTER)"
  else
    ok "$BEFORE -> $AFTER"
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
  die "The website health route failed on port $PORT."
fi

# ------------------------------------------------------------------- crm ----
#
# The CRM (https://<domain>/crm): PostgreSQL, its database, the CRM service,
# its daily timers, and nginx routing for /crm and www. Runs only after the
# website is updated and answering, and never takes it down: a CRM problem is
# reported here and the website keeps serving. See crm/scripts/server.sh.

[ -f "$APP_DIR/crm/scripts/server.sh" ] || die "Required CRM deployment script is missing."
bash "$APP_DIR/crm/scripts/server.sh" || die "CRM deployment failed. See diagnostics above."
systemctl is-active --quiet "$APP_NAME" || die "Website service $APP_NAME is not active after CRM setup."
systemctl is-active --quiet "tkg-crm" || die "CRM service tkg-crm is not active after deployment."
CRM_PORT="$(set -a; . /etc/tkg-crm.env; printf '%s' "${PORT:-3001}")"
curl -fsS -o /dev/null --max-time 8 "http://127.0.0.1:${PORT}/" || die "Website local endpoint failed after CRM setup."
curl -fsS -L -o /dev/null --max-time 8 "http://127.0.0.1:${CRM_PORT}/crm/login" || die "CRM local endpoint failed after deployment on port $CRM_PORT."
ok "website and CRM services are active and answer locally"

step "Checking production URLs"
check_url() { # expected status, URL, expected final URL prefix (or empty)
  local expected="$1" url="$2" expected_final="${3:-}" result code effective
  result="$(curl -fsS -L --max-redirs 8 --connect-timeout 8 --max-time 25 -o /dev/null \
    -w '%{http_code}\n%{url_effective}' "$url")" || die "Request failed: $url"
  code="$(printf '%s\n' "$result" | sed -n '1p')"
  effective="$(printf '%s\n' "$result" | sed -n '2p')"
  [ "$code" = "$expected" ] || die "$url ended with HTTP $code (expected $expected; final URL $effective)."
  if [ -n "$expected_final" ]; then
    [[ "$effective" == "$expected_final"* ]] || die "$url ended at unexpected URL $effective (expected prefix $expected_final)."
  fi
  ok "$url -> HTTP $code ($effective)"
}
check_url 200 "https://$DOMAIN/robots.txt"
check_url 200 "https://$DOMAIN/sitemap.xml"
check_url 200 "https://$DOMAIN/crm" "https://$DOMAIN/crm/login"
check_url 200 "https://$DOMAIN/crm/login" "https://$DOMAIN/crm/login"
check_url 200 "https://$DOMAIN/crm/" "https://$DOMAIN/crm/login"
check_url 200 "https://$DOMAIN/" "https://$DOMAIN/"
check_url 200 "http://$DOMAIN/" "https://$DOMAIN/"
check_url 200 "http://www.$DOMAIN/" "https://$DOMAIN/"
check_url 200 "https://www.$DOMAIN/" "https://$DOMAIN/"
check_url 200 "https://www.$DOMAIN/crm" "https://$DOMAIN/crm/login"
check_url 200 "https://www.$DOMAIN/crm/" "https://$DOMAIN/crm/login"
CRM_STATUS="ok"

# ------------------------------------------------------------------ done ----

cat <<DONE

  ${GREEN}${BOLD}Updated.${RESET}  $SITE_URL
  CRM: ${NEXT_PUBLIC_SITE_URL:-}/crm ($CRM_STATUS)

    journalctl -u $APP_NAME -f     watch the website log
    systemctl status $APP_NAME     check it is running
    journalctl -u tkg-crm -f          watch the CRM log

DONE

if [ -z "${RESEND_API_KEY:-}" ]; then
  warn "No RESEND_API_KEY in $ENV_FILE: inquiries are saved and logged, not emailed."
  printf '\n'
fi
