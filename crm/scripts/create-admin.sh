#!/usr/bin/env bash
#
# Creates the FIRST CRM admin, on the server. There is no public sign-up, so
# someone has to; after that, admins add people from Users in the CRM.
#
#   sudo ./crm/scripts/create-admin.sh
#
# Asks for the email, name and password (the password is not echoed and
# never appears on a command line). Refuses once an active admin exists.
set -euo pipefail

DB_NAME="${CRM_DB_NAME:-tkg_crm}"
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }
[ -f /etc/tkg-crm.env ] || { echo "The CRM is not installed yet: run sudo ./update.sh first." >&2; exit 1; }
PG_PORT="$(set -a; . /etc/tkg-crm.env; printf '%s' "${CRM_PG_PORT:-5432}")"
DOMAIN_URL="$(set -a; . /etc/tkg-crm.env; printf '%s' "${APP_URL:-}")"

read -r -p "Admin email: " email
read -r -p "Full name: " name
read -r -s -p "Password (12+ characters, upper, lower and a number): " password; echo
read -r -s -p "Password again: " again; echo
[ "$password" = "$again" ] || { echo "The passwords do not match." >&2; exit 1; }

# Single quotes doubled: the values reach PostgreSQL as plain string literals
# (standard_conforming_strings is on, so backslashes are literal too).
quote() { printf "'%s'" "${1//\'/\'\'}"; }

if ! output="$(printf 'select public.bootstrap_admin(%s, %s, %s);\n' "$(quote "$email")" "$(quote "$name")" "$(quote "$password")" \
  | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -p "$PG_PORT" -d "$DB_NAME" -A -t -f - 2>&1)"; then
  reason="$(printf '%s\n' "$output" | sed -n 's/^.*ERROR: *//p' | head -1)"
  echo "Not created: ${reason:-$output}" >&2
  exit 1
fi

echo "Admin $email created. Sign in at ${DOMAIN_URL}/login"
