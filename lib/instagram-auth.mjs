/**
 * Instagram OAuth + token helpers.
 *
 * Auth flow (Instagram API with Instagram Login, 2024+):
 *   1. /api/instagram/auth/install → 302 to instagram.com/oauth/authorize
 *      with client_id, redirect_uri, scope=instagram_business_basic, state
 *   2. Instagram → redirect_uri with ?code=... &state=...
 *   3. Server exchanges code for short-lived token (1 hour)
 *      → exchanges short-lived for long-lived token (60 days)
 *      → fetches IG profile (id, username, account_type)
 *      → stores at KV key `instagram:token` for this deployment
 *
 * Token refresh:
 *   IG long-lived tokens last 60 days. We lazy-refresh: any time we use
 *   the token, if it's > 30 days old, we refresh it before the call. Keeps
 *   us from needing a cron job for a single-merchant deployment.
 */

import { kv } from '@vercel/kv';
import crypto from 'crypto';

export const SCOPES = ['instagram_business_basic'];

// Pattern A: one IG account per deployment, fixed key.
const TOKEN_KEY = 'instagram:token';
const stateKey = (state) => `instagram:install:state:${state}`;

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH = 'https://graph.instagram.com';

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(','));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function saveInstallState(state, data = {}) {
  await kv.set(stateKey(state), data, { ex: 600 }); // 10 min TTL
}

export async function consumeInstallState(state) {
  if (!state) return null;
  const data = await kv.get(stateKey(state));
  if (data) await kv.del(stateKey(state));
  return data;
}

export function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Exchange the one-time code for a short-lived (1-hour) access token + IG user ID.
 */
export async function exchangeCodeForShortToken({ clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Returns { access_token, user_id, permissions }
  return data;
}

/**
 * Trade a short-lived token for a long-lived one (60-day expiry).
 */
export async function exchangeForLongLivedToken({ clientSecret, shortToken }) {
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('access_token', shortToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Long-lived token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Returns { access_token, token_type, expires_in }
  return data;
}

/**
 * Refresh a long-lived token. Token must be at least 24 hours old.
 * Returns a fresh 60-day token.
 */
export async function refreshLongLivedToken({ accessToken }) {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  return await res.json();
}

export async function fetchProfile(accessToken) {
  const url = new URL(`${GRAPH}/me`);
  url.searchParams.set('fields', 'id,username,account_type');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Profile fetch failed (${res.status}): ${text}`);
  }
  return await res.json();
}

export async function fetchRecentMedia(accessToken, limit = 6) {
  const url = new URL(`${GRAPH}/me/media`);
  url.searchParams.set('fields', 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Media fetch failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Stores the connection. Includes when token was issued so we know when to refresh.
 */
export async function saveConnection({ accessToken, expiresIn, igUserId, username, accountType }) {
  const now = Date.now();
  const expiresAtMs = now + (Number(expiresIn) || 60 * 24 * 60 * 60) * 1000;
  await kv.set(TOKEN_KEY, {
    accessToken,
    igUserId,
    username,
    accountType,
    issuedAt: now,
    expiresAt: expiresAtMs,
  });
}

export async function getConnection() {
  return await kv.get(TOKEN_KEY);
}

export async function clearConnection() {
  await kv.del(TOKEN_KEY);
}

/**
 * Returns a usable access token. Lazy-refreshes if the token is older than
 * 30 days. Throws if no connection or refresh fails.
 */
export async function getValidAccessToken() {
  const conn = await getConnection();
  if (!conn || !conn.accessToken) {
    throw new Error('Instagram is not connected');
  }
  const ageDays = (Date.now() - (conn.issuedAt || 0)) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) return conn.accessToken;

  // Refresh — keeps us within the 60-day window
  try {
    const refreshed = await refreshLongLivedToken({ accessToken: conn.accessToken });
    await saveConnection({
      accessToken: refreshed.access_token,
      expiresIn: refreshed.expires_in,
      igUserId: conn.igUserId,
      username: conn.username,
      accountType: conn.accountType,
    });
    return refreshed.access_token;
  } catch (e) {
    // If refresh fails, return the existing token — caller will see the
    // Graph API error if it's actually expired.
    console.error('IG token refresh failed:', e.message);
    return conn.accessToken;
  }
}

export function buildRedirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/instagram/auth/callback`;
}
