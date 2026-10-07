import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inject } from 'vitest';

// The app's server modules read their configuration from process.env.
const db = inject('db');
process.env.APP_URL = 'http://127.0.0.1:3001/crm';
process.env.DATABASE_URL = db.databaseUrl;
process.env.DATABASE_ADMIN_URL = db.adminUrl;
process.env.CRM_SESSION_SECRET = db.sessionSecret;
process.env.CRM_INGEST_SECRET = 'ingest-test-secret-'.padEnd(48, 'z');
process.env.DOCUMENTS_DIR = mkdtempSync(join(tmpdir(), 'crm-docs-'));
