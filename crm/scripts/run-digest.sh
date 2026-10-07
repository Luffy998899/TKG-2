#!/usr/bin/env bash
# Run by the tkg-crm-digest systemd timer at 08:00 America/Vancouver (see
# server.sh). Asks the CRM to send today's reminder emails. The CRON_SECRET
# comes from /etc/tkg-crm.env (EnvironmentFile) and reaches curl on stdin,
# never on a command line.
set -euo pipefail
: "${CRON_SECRET:?CRON_SECRET is not set}"
printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
  | curl -fsS --max-time 120 --config - "http://127.0.0.1:${PORT:-3001}/crm/api/cron/digest"
echo
