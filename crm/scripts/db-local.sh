#!/usr/bin/env bash
#
# A throwaway PostgreSQL 17 in Docker for development and the test suites.
# Nothing here ever touches the server's database.
#
#   bash scripts/db-local.sh start   # container + database + migrations + login
#   bash scripts/db-local.sh reset   # drop everything and start again
#   bash scripts/db-local.sh seed    # owner@crm-local.test (admin) + riya.rep@crm-local.test
#   bash scripts/db-local.sh stop
#   bash scripts/db-local.sh psql    # a superuser shell
#
# Connection for .env.local:
#   DATABASE_URL=postgres://tkg_crm_app:tkg_crm_app_local@127.0.0.1:55432/tkg_crm
set -euo pipefail
export MSYS_NO_PATHCONV=1

NAME=tkg-crm-db
PORT=55432
APP_PASSWORD=tkg_crm_app_local
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPER=(docker exec -i "$NAME" psql -X -v ON_ERROR_STOP=1 -q -U postgres)

wait_ready() {
  for _ in $(seq 1 60); do
    if docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "PostgreSQL did not start" >&2
  exit 1
}

create_db() {
  if ! "${SUPER[@]}" -d postgres -A -t -c "select 1 from pg_database where datname = 'tkg_crm'" | grep -q 1; then
    "${SUPER[@]}" -d postgres -c "create database tkg_crm"
  fi
  PSQL="docker exec -i $NAME psql -U postgres -d tkg_crm" bash "$HERE/db-migrate.sh"
  "${SUPER[@]}" -d tkg_crm -v app_password="$APP_PASSWORD" -f - < "$HERE/../db/roles.sql"
}

case "${1:-start}" in
  start)
    if ! docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
      docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "127.0.0.1:$PORT:5432" postgres:17 >/dev/null
    else
      docker start "$NAME" >/dev/null
    fi
    wait_ready
    create_db
    echo "Local database ready on 127.0.0.1:$PORT (database tkg_crm)."
    ;;
  reset)
    wait_ready
    "${SUPER[@]}" -d postgres -c "drop database if exists tkg_crm with (force)"
    create_db
    echo "Local database reset."
    ;;
  seed)
    "${SUPER[@]}" -d tkg_crm <<'SQL'
select app.create_user_row(null, 'owner@crm-local.test', 'Owner (local)', 'admin', 'Local-Owner-2026', null, null, '{"seed":true}')
where not exists (select 1 from auth.users where email = 'owner@crm-local.test');
select app.create_user_row(null, 'riya.rep@crm-local.test', 'Riya Rep', 'sales_rep', 'Local-Rep-2026x', null, null, '{"seed":true}')
where not exists (select 1 from auth.users where email = 'riya.rep@crm-local.test');
SQL
    echo "Seeded: owner@crm-local.test / Local-Owner-2026 (admin), riya.rep@crm-local.test / Local-Rep-2026x (rep)."
    ;;
  stop)
    docker stop "$NAME" >/dev/null && echo "Stopped."
    ;;
  psql)
    docker exec -it "$NAME" psql -U postgres -d tkg_crm
    ;;
  *)
    echo "usage: $0 start|reset|seed|stop|psql" >&2
    exit 2
    ;;
esac
