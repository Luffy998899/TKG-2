import { inject } from 'vitest';

// The app's server modules read their configuration from process.env.
const stack = inject('stack');
process.env.APP_URL = 'http://127.0.0.1:3001';
process.env.SUPABASE_URL = stack.url;
process.env.SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = stack.serviceKey;
process.env.CRM_SESSION_SECRET = stack.sessionSecret;
