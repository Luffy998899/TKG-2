# Deploying TKG CRM

The CRM runs on **the same server as the website**, at
`https://tkgventuresltd.ca/crm`. There is nothing to sign up for: no Vercel,
no Supabase. One command installs it the first time and updates it after.

## 1. Get the new code onto the server

On the server, in the website's folder (where `update.sh` is):

```bash
git pull --ff-only
```

If that says the branches have **diverged** (the GitHub repository was
replaced), and you have made no edits on the server itself:

```bash
git fetch origin
git reset --hard origin/main
```

Your submissions, uploads, `/admin` settings and `/etc/*.env` files live
outside this folder and are not touched by either command.

## 2. Run the update

```bash
sudo ./update.sh
```

It updates the website exactly as before, and then (`crm/scripts/server.sh`):

1. installs **PostgreSQL 17** from postgresql.org if the server has no
   PostgreSQL 15+ (an existing 15+ is reused);
2. creates the `tkg_crm` database and applies every migration;
3. writes `/etc/tkg-crm.env` with generated secrets (kept on later runs);
4. builds the CRM and runs it as the `tkg-crm` service on an available
   localhost port (3001 by default; the selected port is saved in
   `/etc/tkg-crm.env` and reused on later updates);
5. installs three daily timers (America/Vancouver): contract-expiry reminders
   07:00, the reminder email 08:00, data retention 03:00;
6. points the website's forms at the CRM (`CRM_INGEST_URL` /
   `CRM_INGEST_SECRET` in `/etc/tkg-ventures.env`);
7. rewrites the nginx site config so `/crm` goes to the CRM and everything
   else to the website, and makes **`www.tkgventuresltd.ca` redirect to
   `tkgventuresltd.ca`**, adding `www` to the HTTPS certificate. The previous
   config is kept as `/etc/nginx/sites-available/tkg-ventures.before-crm`.

If anything in the CRM step fails, the website has already been updated and
keeps running; the message says what to fix.

If you want to request a specific CRM port, pass `CRM_PORT` to the update:

```bash
CRM_PORT=3100 bash update.sh
```

If that port is already occupied, the installer selects and saves a free port
from 3001–3999. It does not stop the process that already owns the port.

## 3. Create the first admin

```bash
sudo ./crm/scripts/create-admin.sh
```

It asks for the email, name and password (12+ characters, upper and lower case
and a number). Then sign in at `https://tkgventuresltd.ca/crm/login`. Everyone
else is added from **Users** in the CRM, with a starting password you give
them; they can change it under **More → Security**. The script refuses once an
active admin exists.

## 4. After go-live

- **Commission rules:** *Pipelines & rules*: every pipeline starts at $0. Also
  choose who receives unassigned renewal reminders.
- **Forgotten password:** an admin sets a new one in **Users → Reset
  password**; the person is signed out everywhere.
- **Leaver:** **Users → Deactivate**. Access ends on their next click.
- **Reminder email:** uses the website's Resend key and sender. To use another,
  set `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` in `/etc/tkg-crm.env` and run
  `sudo ./update.sh`.
- **Backups** (do this): a nightly dump of the database and the documents
  folder, copied off the server, e.g. in root's crontab:

  ```
  15 2 * * * sudo -u postgres pg_dump -Fc tkg_crm > /var/backups/tkg_crm.dump && tar -czf /var/backups/tkg-crm-documents.tgz -C /var/lib/tkg-crm documents
  ```

  (add `-p <CRM_PG_PORT>` to pg_dump if `/etc/tkg-crm.env` says the port is not 5432), plus your VPS provider's snapshots.
- **Rotate the website secret:** put the old value in
  `CRM_INGEST_SECRET_PREVIOUS`, a new one in `CRM_INGEST_SECRET` (in
  `/etc/tkg-crm.env`), run `sudo ./update.sh` (it copies the new value to the
  website), then remove the previous value.

## Everyday commands

```bash
journalctl -u tkg-crm -f                 # the CRM's log
systemctl status tkg-crm                 # is it running
systemctl list-timers "tkg-crm-*"        # when the daily jobs run next
sudo -u postgres psql -d tkg_crm         # the database (superuser)
```

Migrations only ever run through `update.sh`, from reviewed commits. Never
change the database schema by hand.
