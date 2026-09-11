#!/usr/bin/env bash
#
# TKG Ventures - first-time server setup.
#
#   sudo ./deploy.sh
#
# Run this ONCE, on a fresh Ubuntu or Debian server, from the directory the
# site's source is in. It asks for the handful of things it cannot work out,
# then installs Node, nginx and certbot, builds the site, puts it behind a
# real HTTPS certificate and starts it as a service that survives reboots.
#
# To ship a change afterwards, use ./update.sh instead. This script is safe to
# re-run - it reuses your previous answers as defaults and overwrites its own
# config rather than duplicating it - but update.sh is faster and does not
# touch the system.
#
# WHAT IT CHANGES ON THE MACHINE
#   /etc/tkg-ventures.env            secrets and settings (root only, chmod 600)
#   /etc/systemd/system/tkg-ventures.service
#   /etc/nginx/sites-available/tkg-ventures  (+ symlink in sites-enabled)
#   /var/lib/tkg/data                submissions, uploads, admin settings
#   a `tkg` system user that owns and runs the app
#
# WHAT IT NEVER TOUCHES
#   Your data directory. Rebuilds and re-runs leave submissions alone.

set -euo pipefail

# ---------------------------------------------------------------- settings --

APP_NAME="tkg-ventures"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="/etc/${APP_NAME}.env"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_FILE="/etc/nginx/sites-available/${APP_NAME}"
SERVICE_USER="tkg"
DATA_DIR="/var/lib/tkg/data"
NODE_MAJOR="20"

# Uploads: six phone photos, shrunk in the browser first. 25m is generous.
MAX_UPLOAD="25m"

# ------------------------------------------------------------------ output --

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step()  { printf '\n%s==>%s %s%s%s\n' "$BLUE" "$RESET" "$BOLD" "$1" "$RESET"; }
ok()    { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
note()  { printf '    %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn()  { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
die()   { printf '\n%sError:%s %s\n\n' "$RED" "$RESET" "$1" >&2; exit 1; }

# ------------------------------------------------------------- preflight ----

[ "$(id -u)" -eq 0 ] || die "Run this with sudo:  sudo ./deploy.sh"
command -v apt-get >/dev/null 2>&1 || die "This script expects Ubuntu or Debian (it uses apt)."
[ -f "$APP_DIR/package.json" ] || die "No package.json in $APP_DIR. Run this from the site's source directory."

# The user who invoked sudo, so the source directory keeps a sane owner.
INVOKING_USER="${SUDO_USER:-root}"

# ------------------------------------------------- reachable by the service --
#
# The app runs as an unprivileged user, so every directory on the way to it
# needs the world-execute bit. /root is mode 0700 on a stock Debian or Ubuntu,
# so a source tree at /root/tkg is unreachable - systemd reports the confusing
# `status=203/EXEC` and nothing explains why.
#
# The mode bits are checked rather than `sudo -u`, because the service user
# does not exist yet at this point.

traversable() {
  local path="$1"
  while [ "$path" != "/" ] && [ -n "$path" ]; do
    local mode
    mode="$(stat -c '%a' "$path" 2>/dev/null)" || return 1
    # Last digit is "other"; bit 1 is execute, which is what lets a user
    # descend through the directory.
    (( (10#${mode: -1} & 1) == 1 )) || return 1
    path="$(dirname "$path")"
  done
  return 0
}

RELOCATE_TO="/opt/${APP_NAME}"
if ! traversable "$APP_DIR"; then
  printf '\n'
  warn "The source is at $APP_DIR, which the service user cannot reach."
  note "A directory on that path (usually /root) is private to its owner, so an"
  note "unprivileged service cannot descend into it. The app has to live"
  note "somewhere world-traversable, like /opt."
  printf '\n    Copy the source to %s and continue from there? %s[Y/n]%s ' \
    "$RELOCATE_TO" "$DIM" "$RESET"
  read -r do_move < /dev/tty
  if [[ -z "$do_move" || "${do_move,,}" == y* ]]; then
    mkdir -p "$RELOCATE_TO"
    # -a keeps permissions and timestamps; the trailing /. copies the contents
    # rather than nesting the directory inside itself.
    cp -a "$APP_DIR/." "$RELOCATE_TO/"
    chmod 755 "$RELOCATE_TO"
    ok "copied to $RELOCATE_TO"
    note "Re-running from there. The original at $APP_DIR is left untouched."
    printf '\n'
    # Re-exec so APP_DIR is recomputed. The guard stops a loop if /opt itself
    # were somehow not traversable.
    if [ "${TKG_RELOCATED:-}" = "1" ]; then
      die "Still not reachable after moving to $RELOCATE_TO. Check permissions on /opt."
    fi
    TKG_RELOCATED=1 exec bash "$RELOCATE_TO/deploy.sh"
  fi
  die "Move the source somewhere world-traversable (for example $RELOCATE_TO) and re-run."
fi

printf '\n%s%s setup%s\n' "$BOLD" "$APP_NAME" "$RESET"
note "Source: $APP_DIR"

# ------------------------------------------------------------------ asking --
#
# Every answer is remembered in $ENV_FILE, so a second run just needs Enter.

declare -A CURRENT=()
if [ -f "$ENV_FILE" ]; then
  note "Found existing settings in $ENV_FILE - press Enter to keep each one."
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_]+$ ]] || continue
    CURRENT["$key"]="${value%\"}"
    CURRENT["$key"]="${CURRENT[$key]#\"}"
  done < "$ENV_FILE"
fi

# Accepts "someone@example.com" and "Display Name <someone@example.com>".
valid_email() {
  local value="$1"
  # Pull the address out of the angle brackets if this is a display form.
  [[ "$value" =~ \<([^\>]+)\> ]] && value="${BASH_REMATCH[1]}"
  [[ "$value" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$ ]]
}

# ask VAR "Question" "fallback default" ["secret" and/or "optional" and/or "email"]
#
# The flags are matched as substrings, so "secret optional" means both. An
# exact comparison here would quietly make the optional keys mandatory and
# loop forever on a blank answer.
ask() {
  local var="$1" question="$2" fallback="${3:-}" mode="${4:-}"
  local existing="${CURRENT[$var]:-}" default="${existing:-$fallback}" reply shown
  local secret=0 optional=0 email=0
  [[ "$mode" == *secret* ]] && secret=1
  [[ "$mode" == *optional* ]] && optional=1
  [[ "$mode" == *email* ]] && email=1

  if [ "$secret" -eq 1 ] && [ -n "$default" ]; then
    shown="(unchanged)"
  else
    shown="$default"
  fi

  while true; do
    if [ -n "$shown" ]; then
      printf '    %s\n    %s[%s]%s ' "$question" "$DIM" "$shown" "$RESET"
    else
      printf '    %s\n    ' "$question"
    fi

    if [ "$secret" -eq 1 ]; then
      read -rs reply < /dev/tty; printf '\n'
    else
      read -r reply < /dev/tty
    fi

    reply="${reply:-$default}"

    if [ -z "$reply" ] && [ "$optional" -eq 0 ]; then
      warn "This one is required."
      continue
    fi

    # A from-address with a typo in it is not rejected until the first real
    # send, hours later, by which point nobody connects the two.
    if [ "$email" -eq 1 ] && [ -n "$reply" ] && ! valid_email "$reply"; then
      warn "That is not a valid email address (it needs an @ and a domain)."
      continue
    fi

    printf -v "$var" '%s' "$reply"
    return 0
  done
}

step "Settings"

# -- domain ------------------------------------------------------------------
while true; do
  ask DOMAIN "Domain this site will be served on (no http://, no trailing slash)" "" ""
  DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
  if [[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$ ]]; then
    break
  fi
  warn "That does not look like a domain. Example: tkgventuresltd.ca"
done

# www is worth including in the certificate, but only if it resolves here -
# certbot fails the whole request otherwise, cert and all.
CERT_DOMAINS=("-d" "$DOMAIN")
if [[ "$DOMAIN" != www.* ]]; then
  printf '    Also cover www.%s in the certificate? Only say yes if a DNS\n    record for it already points at this server. %s[y/N]%s ' \
    "$DOMAIN" "$DIM" "$RESET"
  read -r want_www < /dev/tty
  if [[ "${want_www,,}" == y* ]]; then
    CERT_DOMAINS+=("-d" "www.$DOMAIN")
    WITH_WWW=1
  fi
fi

ask LETSENCRYPT_EMAIL "Email for certificate expiry warnings from Let's Encrypt" "" "email"
ask PORT "Local port for the app (nginx proxies to it; not public)" "3000" ""

step "Admin area"
note "/admin is switched off entirely until a password is set. There is no default."
ask ADMIN_PASSWORD "Password for /admin (use a long random one)" "" "secret"

step "Where inquiries go"
note "Without a Resend key, form submissions are saved and logged but not emailed."
ask RESEND_API_KEY "Resend API key from resend.com/api-keys" "" "secret optional"
[ -z "${RESEND_API_KEY:-}" ] && RESEND_API_KEY=""
ask INQUIRY_TO_EMAIL "Send inquiry notifications to" "info@tkgventuresltd.ca" "email"
ask INQUIRY_FROM_EMAIL "Send them from (this domain must be verified in Resend)" \
  "TKG Ventures <mail@kaisoul.tech>" "email"

step "Optional extras"
note "Address autocomplete already works without a key, on OpenStreetMap."
ask GOOGLE_MAPS_API_KEY "Google Places API key, or leave blank" "" "secret optional"
ask INQUIRY_WEBHOOK_URL "Webhook to POST each inquiry to (Zapier, CRM), or leave blank" "" "optional"

SITE_URL="https://$DOMAIN"

# ------------------------------------------------------------- confirmation -

cat <<SUMMARY

  ${BOLD}About to set this machine up:${RESET}

    Site            $SITE_URL$([ -n "${WITH_WWW:-}" ] && printf ' (+ www)')
    Source          $APP_DIR
    Runs as         $SERVICE_USER on 127.0.0.1:$PORT
    Data kept in    $DATA_DIR
    Admin           $SITE_URL/admin
    Inquiry email   $([ -n "$RESEND_API_KEY" ] && echo "on -> $INQUIRY_TO_EMAIL" || echo "${YELLOW}off - no Resend key${RESET}")
    Autocomplete    $([ -n "$GOOGLE_MAPS_API_KEY" ] && echo "Google Places" || echo "OpenStreetMap (no key)")

  Installs Node $NODE_MAJOR, nginx and certbot, and requests a real HTTPS
  certificate for the domain above. ${BOLD}DNS for it must already point here.${RESET}

SUMMARY

printf '  Continue? %s[y/N]%s ' "$DIM" "$RESET"
read -r go < /dev/tty
[[ "${go,,}" == y* ]] || die "Nothing was changed."

# ------------------------------------------------------------- packages -----

step "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg nginx >/dev/null
ok "nginx"

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]; then
  install -d -m 0755 /usr/share/keyrings
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
    | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
  echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node -v)"

apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
ok "certbot"

# systemd needs an ABSOLUTE path and does not read $PATH, so the real location
# is resolved here rather than assumed to be /usr/bin/node. A machine that
# already had Node (nvm, /usr/local, a distro package) skips the install above
# and will not have it there - which shows up only as `status=203/EXEC`.
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ] || die "Could not find a runnable node binary after installing."
# Resolve symlinks so the unit does not break when an nvm alias moves.
NODE_BIN="$(readlink -f "$NODE_BIN")"
ok "node binary at $NODE_BIN"

# ------------------------------------------------------------------ user ----

step "Service user and data directory"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/tkg --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 /var/lib/tkg "$DATA_DIR"
ok "$SERVICE_USER owns $DATA_DIR"

# ------------------------------------------------------------------- env ----

step "Writing $ENV_FILE"
# Written before the build: NEXT_PUBLIC_SITE_URL is baked into the pages at
# build time, so it has to be correct now rather than at start time.

# Every value is quoted and escaped. systemd strips the quotes, and so does
# bash when update.sh sources this file - without them a value containing a
# space or an angle bracket (the default From address has both) either
# truncates or is read as a redirection.
env_line() {
  local value="${2-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$1" "$value"
}

umask 077
{
  echo "# Written by deploy.sh. Secrets live here; keep it chmod 600."
  echo "# Change a value, then run ./update.sh to rebuild with it."
  echo
  env_line NODE_ENV production
  env_line PORT "$PORT"
  env_line HOSTNAME 127.0.0.1
  echo
  echo "# Canonical URL. Baked into pages at build time, so a change needs a rebuild."
  env_line NEXT_PUBLIC_SITE_URL "$SITE_URL"
  echo
  echo "# Submissions, uploads and /admin overrides. Deliberately outside the app"
  echo "# directory so a rebuild can never delete it."
  env_line TKG_DATA_DIR "$DATA_DIR"
  echo
  env_line ADMIN_PASSWORD "$ADMIN_PASSWORD"
  echo
  env_line RESEND_API_KEY "${RESEND_API_KEY:-}"
  env_line INQUIRY_TO_EMAIL "$INQUIRY_TO_EMAIL"
  env_line INQUIRY_FROM_EMAIL "$INQUIRY_FROM_EMAIL"
  env_line INQUIRY_WEBHOOK_URL "${INQUIRY_WEBHOOK_URL:-}"
  echo
  env_line GOOGLE_MAPS_API_KEY "${GOOGLE_MAPS_API_KEY:-}"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"
ok "secrets stored, readable only by root"

# ----------------------------------------------------------------- build ----

step "Building the site"
note "This takes a few minutes on a small server."
chown -R "$INVOKING_USER":"$INVOKING_USER" "$APP_DIR" 2>/dev/null || true

cd "$APP_DIR"
set -a; . "$ENV_FILE"; set +a

# --include=dev is not optional: the env file above sets NODE_ENV=production,
# and npm then skips devDependencies - which is where TypeScript, Tailwind and
# PostCSS live. Without them the build fails at the first .tsx file.
npm ci --include=dev --no-audit --no-fund
npm run build

# `output: 'standalone'` traces only the code actually reached at runtime, but
# it cannot know about static assets. These two are copied in by hand - the
# app 404s its own CSS and images without them.
step "Staging static assets"
# The destinations are removed first. `cp -r a b` where b already exists
# copies INTO it, giving public/public - and every image on the site 404s.
# Next may or may not have created these itself depending on the version, so
# this must not assume either way.
rm -rf "$APP_DIR/.next/standalone/public" "$APP_DIR/.next/standalone/.next/static"
cp -r "$APP_DIR/public" "$APP_DIR/.next/standalone/public"
mkdir -p "$APP_DIR/.next/standalone/.next"
cp -r "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static"
ok "public/ and .next/static staged"

# The service user needs to read the build and write the ISR cache.
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR/.next"
ok "build owned by $SERVICE_USER"

# --------------------------------------------------------------- service ----

step "Installing the service"
cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=TKG Ventures website
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR/.next/standalone
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN server.js
Restart=always
RestartSec=3

# The app only ever writes to its data directory and its own build cache.
# ProtectHome is deliberately NOT set: it makes /home and /root unreadable,
# and the source directory is often under one of them, which would stop the
# service dead with a confusing "no such file" on server.js.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR $APP_DIR/.next

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now "$APP_NAME" >/dev/null 2>&1 || systemctl restart "$APP_NAME"
sleep 3

if ! systemctl is-active --quiet "$APP_NAME"; then
  journalctl -u "$APP_NAME" -n 40 --no-pager || true
  printf '\n'
  warn "Diagnostics for the failure above:"
  note "  node binary   : $NODE_BIN $([ -x "$NODE_BIN" ] && echo '(ok)' || echo '(MISSING)')"
  note "  server.js     : $APP_DIR/.next/standalone/server.js $([ -f "$APP_DIR/.next/standalone/server.js" ] && echo '(ok)' || echo '(MISSING)')"
  note "  path reachable: $(traversable "$APP_DIR" && echo 'yes' || echo 'NO - see /root vs /opt above')"
  note "  readable by $SERVICE_USER: $(sudo -u "$SERVICE_USER" test -r "$APP_DIR/.next/standalone/server.js" 2>/dev/null && echo 'yes' || echo 'NO')"
  printf '\n'
  die "The service did not start."
fi
ok "service running"

# ----------------------------------------------------------------- nginx ----

step "Configuring nginx"
cat > "$NGINX_FILE" <<NGINX
# Written by deploy.sh. certbot adds the TLS block below on first run.
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN${WITH_WWW:+ www.$DOMAIN};

    # Photo and bill uploads. The browser shrinks images first, so this is
    # headroom rather than an expectation.
    client_max_body_size $MAX_UPLOAD;

    # Next.js fingerprints these filenames, so they can be cached hard.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf "$NGINX_FILE" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 || { nginx -t; die "nginx rejected the config above."; }
systemctl reload nginx
ok "nginx serving $DOMAIN on port 80"

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  ok "firewall opened for http and https"
fi

# ------------------------------------------------------------------- ssl ----

step "Requesting the HTTPS certificate"
note "Let's Encrypt has to reach http://$DOMAIN from the internet for this."

if certbot --nginx "${CERT_DOMAINS[@]}" \
     --non-interactive --agree-tos --email "$LETSENCRYPT_EMAIL" \
     --redirect --keep-until-expiring; then
  ok "certificate installed, http redirects to https"
  systemctl reload nginx
  # Certbot installs its own renewal timer; this just proves it works.
  if systemctl list-timers 2>/dev/null | grep -q certbot; then
    ok "automatic renewal is scheduled"
  fi
  FINAL_URL="https://$DOMAIN"
else
  warn "Certificate request failed. The site is up on http:// meanwhile."
  warn "Usual cause: DNS for $DOMAIN does not point at this server yet."
  warn "Fix the DNS, then run:  sudo certbot --nginx ${CERT_DOMAINS[*]} --redirect"
  FINAL_URL="http://$DOMAIN"
fi

# ------------------------------------------------------------------ done ----

cat <<DONE

  ${GREEN}${BOLD}Done.${RESET}

    Site         $FINAL_URL
    Admin        $FINAL_URL/admin
    Data         $DATA_DIR
    Settings     $ENV_FILE

  ${BOLD}Everyday commands${RESET}
    ./update.sh                        ship a change
    systemctl status $APP_NAME       is it running
    journalctl -u $APP_NAME -f       watch the log

DONE

if [ -z "$RESEND_API_KEY" ]; then
  warn "No Resend key: inquiries are saved and logged, but nobody is emailed."
  warn "Add RESEND_API_KEY to $ENV_FILE and run ./update.sh to turn it on."
  printf '\n'
fi
