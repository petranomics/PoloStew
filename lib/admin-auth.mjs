/**
 * Admin password gate — single-password auth for /admin and /api/admin.
 *
 * Storage:
 *  - bcrypt hash of the password lives in KV at `admin:password_hash`.
 *  - On first login, if no hash exists, we hash and store the bootstrap
 *    password (BOOTSTRAP_PASSWORD), then proceed with normal compare.
 *  - Merchant changes password via /api/admin/auth/change-password — that
 *    overwrites the hash. Old sessions keep working until their JWT expires.
 *
 * Session:
 *  - Signed JWT (using JWT_SECRET env var, already required by this app)
 *    placed in HttpOnly Secure SameSite=Strict cookie `polostew_admin`.
 *  - 7-day expiry.
 *  - Distinct from the customer `accessToken` cookie used by api/middleware/auth.js.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';

const KV_KEY = 'admin:password_hash';
const COOKIE_NAME = 'polostew_admin';
const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 10;
export const BOOTSTRAP_PASSWORD = 'PoloStew2026';

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is required for admin auth');
  return s;
}

async function ensureHash() {
  const existing = await kv.get(KV_KEY);
  if (existing) return existing;
  const hash = await bcrypt.hash(BOOTSTRAP_PASSWORD, BCRYPT_ROUNDS);
  await kv.set(KV_KEY, hash);
  return hash;
}

export async function verifyPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) return false;
  const hash = await ensureHash();
  try {
    return await bcrypt.compare(plain, hash);
  } catch (e) {
    return false;
  }
}

export async function setPassword(newPlain) {
  if (typeof newPlain !== 'string' || newPlain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const hash = await bcrypt.hash(newPlain, BCRYPT_ROUNDS);
  await kv.set(KV_KEY, hash);
}

export function signSession() {
  return jwt.sign({ admin: true }, jwtSecret(), { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token) {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, jwtSecret());
    return decoded && decoded.admin === true;
  } catch (e) {
    return false;
  }
}

export function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.split('=');
    if (k && k.trim() === name) {
      return decodeURIComponent(rest.join('=').trim());
    }
  }
  return null;
}

export function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  let cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  cookie += `; Path=/`;
  cookie += `; Max-Age=${maxAge}`;
  cookie += `; HttpOnly`;
  cookie += `; SameSite=Strict`;
  if (isProd) cookie += `; Secure`;
  appendCookie(res, cookie);
}

export function clearSessionCookie(res) {
  const cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;
  appendCookie(res, cookie);
}

function appendCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie') || [];
  const arr = Array.isArray(existing) ? existing : [existing];
  arr.push(cookie);
  res.setHeader('Set-Cookie', arr);
}

/**
 * Gate helper for admin API endpoints.
 *   if (!(await requireAdmin(req, res))) return;
 * Sends 401 itself when unauthenticated. Returns true when authed.
 */
export async function requireAdmin(req, res) {
  const token = readCookie(req);
  if (!verifySession(token)) {
    res.status(401).json({ error: 'Admin authentication required', code: 'ADMIN_AUTH_REQUIRED' });
    return false;
  }
  return true;
}
