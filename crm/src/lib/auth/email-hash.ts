import { createHmac } from 'node:crypto';

/**
 * Login-lockout key. The database stores this HMAC, never the email, so the
 * attempts table cannot be read back into a list of who tried to sign in.
 */
export const loginEmailHash = (email: string, secret: string): string =>
  createHmac('sha256', secret).update(`login:${email.trim().toLowerCase()}`).digest('hex');
