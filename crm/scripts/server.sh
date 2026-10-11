#!/usr/bin/env bash
#
# TKG CRM on the VPS - install the first time, upgrade every time after.
# Called by ../../update.sh (as root) once the website itself is updated and
# healthy, so nothing here can take the website down: every step that could
# fail leaves the previous state in place.
#
#   1. PostgreSQL 15+ (installs 17 from postgresql.org if none is present)
#   2. the tkg_crm database, its migrations, and the app's own login
#   3. /etc/tkg-crm.env with generated secrets (kept on later runs)
#   4. the CRM build, served by systemd as `tkg-crm` on 127.0.0.1:3001
#   5. daily timers: expiry engine 07:00, digest 08:00, retention 03:00
#      (America/Vancouver)
#   6. nginx: /crm -> the CRM, everything else -> the website,
#      and www.<domain> -> <domain> (the certificate is extended to www)
#   7. the website is told where to send leads (CRM_INGEST_URL/SECRET)
#
# Safe to run any number of times.
set -euo pipefail

CRM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="$(dirname "$CRM_DIR")"
SITE_SERVICE="tkg-ventures"
SITE_ENV="/etc/${SITE_SERVICE}.env"
CRM_SERVICE="tkg-crm"
CRM_ENV="/etc/${CRM_SERVICE}.env"
SERVICE_USER="tkg"
CRM_PORT="3001"
DB_NAME="tkg_crm"
DATA_ROOT="/var/lib/tkg-crm"
DOCS_DIR="$DATA_ROOT/documents"
NGINX_FILE="/etc/nginx/sites-available/${SITE_SERVICE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_SERVICE}"
ACME_ROOT="/var/www/letsencrypt"
RENEW_HOOK="/etc/letsencrypt/renewal-hooks/deploy/tkg-ventures-nginx"
PG_WANTED="17"

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
die()  { printf '\n%sCRM error:%s %s\n\n' "$RED" "$RESET" "$1" >&2; exit 1; }

# ------------------------------------------------------------- preflight ----

[ "$(id -u)" -eq 0 ] || die "Run through update.sh with sudo."
[ -f "$SITE_ENV" ] || die "$SITE_ENV is missing - the website is not set up on this server."
command -v apt-get >/dev/null 2>&1 || die "This expects Ubuntu or Debian (apt)."

SITE_URL="$(set -a; . "$SITE_ENV"; printf '%s' "${NEXT_PUBLIC_SITE_URL:-}")"
DOMAIN="${SITE_URL#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"; DOMAIN="${DOMAIN#www.}"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Could not read the domain from NEXT_PUBLIC_SITE_URL in $SITE_ENV."

NODE_BIN="$(readlink -f "$(command -v node)")"
NODE_VERSION="$("$NODE_BIN" -p 'process.versions.node')"
node_ok="$("$NODE_BIN" -e 'const [a,b]=process.versions.node.split(".").map(Number); console.log(a>20||(a===20&&b>=9)?1:0)')"
[ "$node_ok" = "1" ] || die "The CRM needs Node 20.9 or newer (this server has $NODE_VERSION)."

printf '\n%sTKG CRM%s  https://%s/crm\n' "$BOLD" "$RESET" "$DOMAIN"

# ------------------------------------------------------------ PostgreSQL ----

step "PostgreSQL"

# The highest online cluster at version 15+ (security_invoker views need 15).
pick_cluster() {
  command -v pg_lsclusters >/dev/null 2>&1 || return 1
  pg_lsclusters --no-header 2>/dev/null | awk '$1 >= 15 && $4 == "online" { print $1, $3 }' | sort -n | tail -1
}

CLUSTER="$(pick_cluster || true)"
if [ -z "$CLUSTER" ]; then
  note "No PostgreSQL 15+ here yet: installing PostgreSQL $PG_WANTED from postgresql.org."
  apt-get update -qq
  apt-get install -y -qq postgresql-common ca-certificates >/dev/null
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
  apt-get install -y -qq "postgresql-$PG_WANTED" >/dev/null
  systemctl enable --now postgresql >/dev/null 2>&1 || true
  sleep 2
  CLUSTER="$(pick_cluster || true)"
  [ -n "$CLUSTER" ] || die "PostgreSQL $PG_WANTED was installed but no cluster is online. See: pg_lsclusters"
fi
PG_VERSION="${CLUSTER%% *}"
PG_PORT="${CLUSTER##* }"
ok "PostgreSQL $PG_VERSION on local port $PG_PORT"

PSQL_SUPER=(sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -p "$PG_PORT")

if ! "${PSQL_SUPER[@]}" -d postgres -A -t -c "select 1 from pg_database where datname = '$DB_NAME'" | grep -q 1; then
  "${PSQL_SUPER[@]}" -d postgres -c "create database $DB_NAME" >/dev/null
  ok "database $DB_NAME created"
fi

step "Database migrations"
PSQL="sudo -u postgres psql -p $PG_PORT -d $DB_NAME" bash "$CRM_DIR/scripts/db-migrate.sh"

# ------------------------------------------------------------- settings ----

step "Settings ($CRM_ENV)"

random_hex() { openssl rand -hex "$1"; }
random_b64() { openssl rand -base64 48 | tr -d '\n'; }
env_get() { [ -f "$CRM_ENV" ] && (set -a; . "$CRM_ENV"; eval "printf '%s' \"\${$1:-}\"") || true; }
env_line() {
  local value="${2-}"
  value="${value//\\/\\\\}"; value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$1" "$value"
}

DB_PASSWORD="$(env_get CRM_DB_PASSWORD)";            [ -n "$DB_PASSWORD" ] || DB_PASSWORD="$(random_hex 24)"
SESSION_SECRET="$(env_get CRM_SESSION_SECRET)";      [ -n "$SESSION_SECRET" ] || SESSION_SECRET="$(random_b64)"
INGEST_SECRET="$(env_get CRM_INGEST_SECRET)";        [ -n "$INGEST_SECRET" ] || INGEST_SECRET="$(random_b64)"
INGEST_PREVIOUS="$(env_get CRM_INGEST_SECRET_PREVIOUS)"
CRON_SECRET="$(env_get CRON_SECRET)";                [ -n "$CRON_SECRET" ] || CRON_SECRET="$(random_b64)"
# The daily reminder email reuses the website's Resend key and sender unless set here.
RESEND_KEY="$(env_get RESEND_API_KEY)";              [ -n "$RESEND_KEY" ] || RESEND_KEY="$(set -a; . "$SITE_ENV"; printf '%s' "${RESEND_API_KEY:-}")"
DIGEST_FROM="$(env_get DIGEST_FROM_EMAIL)";          [ -n "$DIGEST_FROM" ] || DIGEST_FROM="$(set -a; . "$SITE_ENV"; printf '%s' "${INQUIRY_FROM_EMAIL:-}")"

umask 077
{
  echo "# Written by crm/scripts/server.sh. Secrets live here; keep it chmod 600."
  echo "# Values are kept on every update. Change one, then run sudo ./update.sh."
  echo
  env_line NODE_ENV production
  env_line PORT "$CRM_PORT"
  env_line HOSTNAME 127.0.0.1
  env_line APP_URL "https://$DOMAIN/crm"
  echo
  echo "# PostgreSQL $PG_VERSION on this machine. CRM_DB_PASSWORD is the app login's password."
  env_line CRM_DB_PASSWORD "$DB_PASSWORD"
  env_line CRM_PG_PORT "$PG_PORT"
  env_line DATABASE_URL "postgres://tkg_crm_app:${DB_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_NAME}"
  env_line DOCUMENTS_DIR "$DOCS_DIR"
  echo
  env_line CRM_SESSION_SECRET "$SESSION_SECRET"
  env_line CRM_INGEST_SECRET "$INGEST_SECRET"
  env_line CRM_INGEST_SECRET_PREVIOUS "$INGEST_PREVIOUS"
  env_line CRON_SECRET "$CRON_SECRET"
  echo
  echo "# Daily 08:00 reminder email (contract expiries, overdue follow-ups)."
  env_line RESEND_API_KEY "$RESEND_KEY"
  env_line DIGEST_FROM_EMAIL "$DIGEST_FROM"
} > "$CRM_ENV.new"
chmod 600 "$CRM_ENV.new"; chown root:root "$CRM_ENV.new"
mv "$CRM_ENV.new" "$CRM_ENV"
ok "secrets kept in $CRM_ENV (root only)"

# The app's database login: no rights of its own, password from the env file.
"${PSQL_SUPER[@]}" -d "$DB_NAME" -v app_password="$DB_PASSWORD" -f - < "$CRM_DIR/db/roles.sql" >/dev/null
ok "database login tkg_crm_app ready"

install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0700 "$DATA_ROOT" "$DOCS_DIR"
ok "documents kept in $DOCS_DIR (readable only by $SERVICE_USER)"

# ----------------------------------------------------------------- build ----

step "Building the CRM"
note "The running CRM is untouched until this succeeds."
cd "$CRM_DIR"
BUILT=0
if npm ci --include=dev --no-audit --no-fund >/dev/null \
  && (set -a; . "$CRM_ENV"; set +a; npm run build); then
  rm -rf "$CRM_DIR/.next/standalone/.next/static"
  mkdir -p "$CRM_DIR/.next/standalone/.next"
  cp -r "$CRM_DIR/.next/static" "$CRM_DIR/.next/standalone/.next/static"
  chown -R "$SERVICE_USER":"$SERVICE_USER" "$CRM_DIR/.next"
  BUILT=1
  ok "build succeeded"
elif [ -f "$CRM_DIR/.next/standalone/server.js" ]; then
  die "The CRM build failed; the previous CRM version is still running. Deployment is incomplete."
else
  die "The CRM build failed and there is no previous build to keep running. The website was updated normally."
fi

# --------------------------------------------------------------- systemd ----

step "Services and daily timers"

cat > "/etc/systemd/system/${CRM_SERVICE}.service" <<UNIT
[Unit]
Description=TKG CRM (https://$DOMAIN/crm)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$CRM_DIR/.next/standalone
EnvironmentFile=$CRM_ENV
ExecStart=$NODE_BIN server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$DATA_ROOT $CRM_DIR/.next

[Install]
WantedBy=multi-user.target
UNIT

timer() { # name, description, OnCalendar, [Service] body
  cat > "/etc/systemd/system/${CRM_SERVICE}-$1.service" <<UNIT
[Unit]
Description=$2
After=postgresql.service

[Service]
Type=oneshot
$4
UNIT
  cat > "/etc/systemd/system/${CRM_SERVICE}-$1.timer" <<UNIT
[Unit]
Description=$2 (schedule)

[Timer]
OnCalendar=$3
Persistent=true

[Install]
WantedBy=timers.target
UNIT
}

timer expiry "TKG CRM contract expiry reminders" "*-*-* 07:00:00 America/Vancouver" \
"User=postgres
ExecStart=/usr/bin/psql -X -q -p $PG_PORT -d $DB_NAME -c \"select app.run_expiry_engine()\""

timer retention "TKG CRM data retention (Q13)" "*-*-* 03:00:00 America/Vancouver" \
"User=postgres
ExecStart=/usr/bin/psql -X -q -p $PG_PORT -d $DB_NAME -c \"select app.run_retention()\""

timer digest "TKG CRM daily reminder email" "*-*-* 08:00:00 America/Vancouver" "User=$SERVICE_USER
EnvironmentFile=$CRM_ENV
ExecStart=/bin/bash $CRM_DIR/scripts/run-digest.sh"

systemctl daemon-reload
systemctl enable "$CRM_SERVICE" >/dev/null 2>&1
for t in expiry retention digest; do systemctl enable --now "${CRM_SERVICE}-$t.timer" >/dev/null 2>&1; done
ok "tkg-crm service and its 3 timers installed"

if [ "$BUILT" = "1" ] || ! systemctl is-active --quiet "$CRM_SERVICE"; then
  systemctl restart "$CRM_SERVICE"
fi
HEALTHY=0
for _ in $(seq 1 20); do
  sleep 1
  if curl -fsS -o /dev/null --max-time 4 "http://127.0.0.1:${CRM_PORT}/crm/login"; then HEALTHY=1; break; fi
done
if [ "$HEALTHY" -ne 1 ]; then
  journalctl -u "$CRM_SERVICE" -n 40 --no-pager || true
  die "The CRM did not answer on port $CRM_PORT. The log above says why. The website is unaffected."
fi
ok "CRM answering on port $CRM_PORT"

# ---------------------------------------------- website -> CRM ingestion ----

step "Connecting the website's forms"
site_changed=0
set_site_env() { # key value
  local current
  current="$(set -a; . "$SITE_ENV"; eval "printf '%s' \"\${$1:-}\"")"
  [ "$current" = "$2" ] && return 0
  local escaped="${2//\\/\\\\}"; escaped="${escaped//\"/\\\"}"
  if grep -q "^$1=" "$SITE_ENV"; then
    # Rewrite just that line, keeping everything else exactly as it was.
    local tmp; tmp="$(mktemp)"
    awk -v key="$1" -v line="$1=\"$escaped\"" 'index($0, key "=") == 1 { print line; next } { print }' "$SITE_ENV" > "$tmp"
    cat "$tmp" > "$SITE_ENV"; rm -f "$tmp"
  else
    printf '\n# Sales inquiries go to the CRM on this machine (crm/scripts/server.sh).\n%s="%s"\n' "$1" "$escaped" >> "$SITE_ENV"
  fi
  site_changed=1
}
set_site_env CRM_INGEST_URL "http://127.0.0.1:${CRM_PORT}/crm/api/ingest/lead"
set_site_env CRM_INGEST_SECRET "$INGEST_SECRET"
if [ "$site_changed" = "1" ]; then
  systemctl restart "$SITE_SERVICE"
  SITE_PORT_CHECK="$(set -a; . "$SITE_ENV"; printf '%s' "${PORT:-3000}")"
  SITE_HEALTHY=0
  for _ in $(seq 1 20); do
    sleep 1
    if curl -fsS -o /dev/null --max-time 4 "http://127.0.0.1:${SITE_PORT_CHECK}/"; then SITE_HEALTHY=1; break; fi
  done
  [ "$SITE_HEALTHY" = "1" ] || die "The website failed its local health check after its CRM ingest settings changed."
  ok "website now sends sales inquiries to the CRM (restarted it to pick that up)"
else
  ok "website already sends sales inquiries to the CRM"
fi

# ----------------------------------------------------------------- nginx ----

step "nginx: /crm and www"

CERT_DIR="$(grep -oE 'ssl_certificate[[:space:]]+/etc/letsencrypt/live/[^/]+' "$NGINX_FILE" 2>/dev/null | head -1 | awk '{ print $2 }' || true)"
[ -n "$CERT_DIR" ] || { [ -d "/etc/letsencrypt/live/$DOMAIN" ] && CERT_DIR="/etc/letsencrypt/live/$DOMAIN"; } || true
SITE_PORT="$(set -a; . "$SITE_ENV"; printf '%s' "${PORT:-3000}")"
install -d -m 0755 "$ACME_ROOT"
install -d -m 0755 "$(dirname "$RENEW_HOOK")"
if [ -e "$RENEW_HOOK" ] && ! grep -q 'TKG Ventures certificate renewal hook' "$RENEW_HOOK"; then
  die "$RENEW_HOOK already exists and is not this deployment's hook; refusing to replace it."
fi
cat > "$RENEW_HOOK.new" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
# TKG Ventures certificate renewal hook: validate before every Nginx reload.
nginx -t
systemctl reload nginx
HOOK
if [ ! -f "$RENEW_HOOK" ] || ! cmp -s "$RENEW_HOOK.new" "$RENEW_HOOK"; then
  mv "$RENEW_HOOK.new" "$RENEW_HOOK"
  chmod 0750 "$RENEW_HOOK"
else
  rm -f "$RENEW_HOOK.new"
fi

cert_covers_www() { [ -n "$CERT_DIR" ] && openssl x509 -in "$CERT_DIR/cert.pem" -noout -text 2>/dev/null | grep -q "DNS:www.$DOMAIN"; }
cert_covers_apex() { [ -n "$CERT_DIR" ] && openssl x509 -in "$CERT_DIR/cert.pem" -noout -text 2>/dev/null | grep -q "DNS:$DOMAIN"; }
cert_is_valid() { [ -n "$CERT_DIR" ] && openssl x509 -in "$CERT_DIR/cert.pem" -checkend 1 -noout >/dev/null 2>&1; }
if [ -n "$CERT_DIR" ] && { ! cert_covers_apex || ! cert_is_valid; }; then
  warn "No currently valid apex certificate found at $CERT_DIR; preparing HTTP for ACME and certificate repair."
  CERT_DIR=""
fi

PROXY_HEADERS="proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;"

app_locations() {
  cat <<LOCATIONS
    # Photo and bill uploads (site) and documents up to 15 MB (CRM).
    client_max_body_size 25m;

    # The CRM. Its own pages, API and static files all live under /crm.
    location = /crm {
        proxy_pass http://127.0.0.1:$CRM_PORT;
        $PROXY_HEADERS
    }
    location /crm/ {
        proxy_pass http://127.0.0.1:$CRM_PORT;
        $PROXY_HEADERS
    }

    # The website. Next.js fingerprints these filenames, so they cache hard.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$SITE_PORT;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location / {
        proxy_pass http://127.0.0.1:$SITE_PORT;
        $PROXY_HEADERS
    }
LOCATIONS
}

tls_lines() {
  echo "    ssl_certificate $CERT_DIR/fullchain.pem;"
  echo "    ssl_certificate_key $CERT_DIR/privkey.pem;"
  [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && echo "    include /etc/letsencrypt/options-ssl-nginx.conf;"
  [ -f /etc/letsencrypt/ssl-dhparams.pem ] && echo "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
  return 0
}

write_nginx() { # $1 = 1 to add the https www -> apex block
  {
    echo "# Written by crm/scripts/server.sh (run by update.sh): the TKG Ventures"
    echo "# website and the CRM at /crm. Regenerated on every update - edit the"
    echo "# script, not this file."
    echo
    echo "server {"
    echo "    listen 80;"
    echo "    listen [::]:80;"
    echo "    server_name $DOMAIN www.$DOMAIN;"
    echo
    echo "    # Let's Encrypt renewals, for both names."
    echo "    location ^~ /.well-known/acme-challenge/ { root $ACME_ROOT; }"
    echo
    if [ -n "$CERT_DIR" ]; then
      echo "    location / { return 301 https://$DOMAIN\$request_uri; }"
      echo "}"
      echo
      if [ "$1" = "1" ]; then
        echo "# www is one more name for the same site: send it to the main address."
        echo "server {"
        echo "    listen 443 ssl;"
        echo "    listen [::]:443 ssl;"
        echo "    server_name www.$DOMAIN;"
        tls_lines
        echo "    return 301 https://$DOMAIN\$request_uri;"
        echo "}"
        echo
      fi
      echo "server {"
      echo "    listen 443 ssl;"
      echo "    listen [::]:443 ssl;"
      echo "    server_name $DOMAIN;"
      tls_lines
      echo
      app_locations
      echo "}"
    else
      # No certificate yet (deploy.sh's certbot step failed): plain http.
      app_locations
      echo "}"
    fi
  } > "$NGINX_FILE.new"
}

apply_nginx() { # $1 = www https block
  install -d -m 0755 "$(dirname "$NGINX_FILE")" "$(dirname "$NGINX_ENABLED")"
  if [ -e "$NGINX_ENABLED" ] || [ -L "$NGINX_ENABLED" ]; then
    [ -L "$NGINX_ENABLED" ] || die "$NGINX_ENABLED exists as a regular file; refusing to replace another virtual host."
    [ "$(readlink -f "$NGINX_ENABLED" 2>/dev/null || true)" = "$(readlink -m "$NGINX_FILE")" ] || die "$NGINX_ENABLED points to another site; refusing to replace it."
  fi
  # Never take over a domain already declared by another enabled virtual host.
  local domain_re other
  domain_re="${DOMAIN//./\\.}"
  while IFS= read -r other; do
    [ -n "$other" ] || continue
    [ "$(readlink -f "$other" 2>/dev/null || true)" = "$(readlink -m "$NGINX_FILE")" ] && continue
    if grep -Eq "server_name[^;]*(^|[[:space:]])(www\\.)?${domain_re}([[:space:];]|$)" "$other"; then
      die "Domain $DOMAIN is already declared in $other; refusing to change an unrelated virtual host."
    fi
  done < <(find /etc/nginx/sites-enabled /etc/nginx/conf.d -maxdepth 1 \( -type f -o -type l \) -print 2>/dev/null)

  local previous backup
  previous="$(mktemp)"
  if [ -f "$NGINX_FILE" ]; then
    cp -a "$NGINX_FILE" "$previous"
  else
    : > "$previous"
  fi
  write_nginx "$1"
  if [ -f "$NGINX_FILE" ] && cmp -s "$NGINX_FILE.new" "$NGINX_FILE"; then
    rm -f "$NGINX_FILE.new" "$previous"
    if [ ! -L "$NGINX_ENABLED" ]; then ln -s "$NGINX_FILE" "$NGINX_ENABLED"; fi
    nginx -t || return 1
    return 0
  fi
  [ -z "$CERT_DIR" ] || { cert_covers_apex && cert_is_valid; } || {
    rm -f "$NGINX_FILE.new" "$previous"
    die "The existing certificate is expired, expiring within 30 days, or does not cover $DOMAIN. Renew it before changing Nginx."
  }
  if [ -f "$NGINX_FILE" ] && ! grep -q 'Written by crm/scripts/server.sh' "$NGINX_FILE" && ! grep -q 'Written by deploy.sh' "$NGINX_FILE"; then
    rm -f "$NGINX_FILE.new" "$previous"
    die "$NGINX_FILE is not recognized as this deployment's managed config; refusing to overwrite it."
  fi
  if [ -f "$NGINX_FILE" ]; then
    backup="${NGINX_FILE}.backup.$(date -u +%Y%m%dT%H%M%SZ)"
    cp -a "$NGINX_FILE" "$backup"
    ok "backed up the managed Nginx site config to $backup"
  fi
  local created_link=0
  mv "$NGINX_FILE.new" "$NGINX_FILE"
  if [ ! -e "$NGINX_ENABLED" ] && [ ! -L "$NGINX_ENABLED" ]; then
    ln -s "$NGINX_FILE" "$NGINX_ENABLED"
    created_link=1
  fi
  if nginx -t; then
    if systemctl reload nginx; then
      rm -f "$previous"
      return 0
    fi
    warn "nginx reload failed; restoring the previous managed config."
  else
    warn "nginx -t rejected the candidate config; restoring the previous managed config."
  fi
  if [ -s "$previous" ]; then cp -a "$previous" "$NGINX_FILE"; else rm -f "$NGINX_FILE"; fi
  [ "$created_link" = "0" ] || rm -f "$NGINX_ENABLED"
  rm -f "$previous"
  nginx -t && systemctl reload nginx || true
  return 1
}

if ! apply_nginx "$(cert_covers_www && echo 1 || echo 0)"; then
  die "Could not safely apply the Nginx configuration. The existing site configuration was restored."
else
  ok "https://$DOMAIN/crm routed to the CRM; everything else to the website"

  # www: extend the certificate when www points at this server too.
  if [ -n "$CERT_DIR" ] && ! cert_covers_www; then
    apex_ip="$( (getent ahostsv4 "$DOMAIN" || true) | awk 'NR==1 { print $1 }')"
    www_ip="$( (getent ahostsv4 "www.$DOMAIN" || true) | awk 'NR==1 { print $1 }')"
    if [ -n "$www_ip" ] && [ "$www_ip" = "$apex_ip" ]; then
      note "Adding www.$DOMAIN to the HTTPS certificate."
      if certbot certonly --webroot -w "$ACME_ROOT" --cert-name "$(basename "$CERT_DIR")" \
           -d "$DOMAIN" -d "www.$DOMAIN" --expand --non-interactive --agree-tos --keep-until-expiring \
           --deploy-hook "$RENEW_HOOK" && cert_covers_www; then
        apply_nginx 1 && ok "https://www.$DOMAIN now redirects to https://$DOMAIN"
      else
        die "Let's Encrypt did not issue the www certificate. Confirm DNS and port 80, then retry."
      fi
    else
      die "www.$DOMAIN does not resolve to the same server as $DOMAIN; correct DNS before deploying."
    fi
  elif cert_covers_www; then
    ok "https://www.$DOMAIN redirects to https://$DOMAIN"
  fi
fi

# First-time HTTPS setup: the HTTP-only managed block above serves ACME
# challenges. Once both names resolve here, issue one certificate for both.
if [ -z "$CERT_DIR" ]; then
  apex_ip="$( (getent ahostsv4 "$DOMAIN" || true) | awk 'NR==1 { print $1 }')"
  www_ip="$( (getent ahostsv4 "www.$DOMAIN" || true) | awk 'NR==1 { print $1 }')"
  [ -n "$apex_ip" ] && [ -n "$www_ip" ] && [ "$apex_ip" = "$www_ip" ] || die "Both $DOMAIN and www.$DOMAIN must resolve to the same server before issuing HTTPS. IPv4: apex=${apex_ip:-missing}, www=${www_ip:-missing}."
  command -v certbot >/dev/null 2>&1 || die "certbot is missing; install certbot and its Nginx plugin before enabling HTTPS."
  step "Issuing HTTPS certificate for apex and www"
  certbot certonly --webroot -w "$ACME_ROOT" --cert-name "$DOMAIN" -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos --keep-until-expiring --deploy-hook "$RENEW_HOOK" || die "Certificate issuance failed. Confirm both DNS names point here and port 80 is reachable."
  CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
  cert_covers_www && cert_covers_apex && cert_is_valid || die "The issued certificate is invalid or does not cover both requested names."
  apply_nginx 1 || die "Nginx rejected the HTTPS configuration after certificate issuance."
  ok "HTTPS certificate covers $DOMAIN and www.$DOMAIN"
fi

if systemctl list-unit-files certbot.timer --no-legend 2>/dev/null | grep -q 'certbot.timer'; then
  systemctl enable --now certbot.timer >/dev/null 2>&1 || die "Could not enable automatic certbot renewal."
  ok "automatic certificate renewal is enabled"
else
  die "certbot.timer is not installed; automatic certificate renewal is required. Install/enable Certbot's systemd timer and retry."
fi

# Assert the CRM route responds through Nginx and exposes its actual login UI.
for crm_url in "https://$DOMAIN/crm/login" "https://$DOMAIN/crm/" "https://www.$DOMAIN/crm/login" "https://www.$DOMAIN/crm/"; do
  code="$(curl -sS -L --max-redirs 8 -o /tmp/tkg-crm-smoke.html -w '%{http_code}' --max-time 15 "$crm_url" || true)"
  if [ "$code" != "200" ] || ! grep -Eqi 'name="(email|username)"|Sign in|Log in|Login' /tmp/tkg-crm-smoke.html; then
    printf 'CRM public smoke failure: %s returned HTTP %s\n' "$crm_url" "${code:-request error}" >&2
    journalctl -u "$CRM_SERVICE" -n 30 --no-pager || true
    die "Public CRM route did not serve the expected login/application page."
  fi
done
rm -f /tmp/tkg-crm-smoke.html
ok "canonical public CRM login and trailing-slash routes render through Nginx"

# ------------------------------------------------------------------ done ----

ADMINS="$("${PSQL_SUPER[@]}" -d "$DB_NAME" -A -t -c "select count(*) from public.profiles where role = 'admin' and active")"
printf '\n  %s%sCRM ready.%s  https://%s/crm\n' "$GREEN" "$BOLD" "$RESET" "$DOMAIN"
if [ "${ADMINS:-0}" = "0" ]; then
  printf '\n  %sNo admin yet.%s Create the first one (it asks for email, name, password):\n\n    sudo %s/scripts/create-admin.sh\n' "$BOLD" "$RESET" "$CRM_DIR"
fi
printf '\n    journalctl -u %s -f              watch the CRM log\n    systemctl list-timers "tkg-crm-*"    when the daily jobs run next\n\n' "$CRM_SERVICE"
