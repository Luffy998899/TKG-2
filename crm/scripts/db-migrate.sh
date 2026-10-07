#!/usr/bin/env bash
#
# Applies crm/db/migrations/*.sql in order. Each file runs once, in a single
# transaction, and is recorded in crm_meta.schema_migrations, so re-running
# is always safe.
#
# PSQL is the command that reaches the CRM database as a SUPERUSER:
#   server:  PSQL="sudo -u postgres psql -d tkg_crm"          (update.sh)
#   local:   PSQL="docker exec -i tkg-crm-db psql -U postgres -d tkg_crm"
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../db/migrations" && pwd)"
: "${PSQL:?Set PSQL to the psql command for the CRM database (see the top of this file).}"

run() { $PSQL -X -v ON_ERROR_STOP=1 -q "$@"; }

run -c "set client_min_messages = warning;
        create schema if not exists crm_meta;
        create table if not exists crm_meta.schema_migrations (
          version text primary key,
          applied_at timestamptz not null default now()
        );" >/dev/null

applied="$(run -A -t -c "select version from crm_meta.schema_migrations")"
count=0
for file in "$DIR"/*.sql; do
  version="$(basename "$file" .sql)"
  if grep -qx "$version" <<<"$applied"; then continue; fi
  echo "  applying $version"
  # One transaction: the migration and its bookkeeping row land together.
  { echo "set client_min_messages = warning;"; cat "$file"; printf "\ninsert into crm_meta.schema_migrations (version) values ('%s');\n" "$version"; } \
    | run -1 -f -
  count=$((count + 1))
done
echo "  migrations: $count applied, $(grep -c . <<<"$applied" || true) already in place"
