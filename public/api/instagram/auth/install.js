/**
 * GET /api/instagram/auth/install
 *
 * Kicks off the Instagram OAuth flow. Generates a CSRF state token, stores
 * it in KV with 10-min TTL, and 302-redirects to instagram.com/oauth/authorize.
 *
 * Admin-only: this endpoint changes which IG account the storefront is
 * connected to, so it must be gated.
 */

import {
  buildAuthorizeUrl,
  buildRedirectUri,
  generateState,
  saveInstallState,
} from '../../../lib/instagram-auth.mjs';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;

  const clientId = process.env.META_APP_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'META_APP_ID not configured' });
  }

  const state = generateState();
  await saveInstallState(state, { initiatedAt: Date.now() });

  const redirectUri = buildRedirectUri(req);
  const url = buildAuthorizeUrl({ clientId, redirectUri, state });

  res.redirect(302, url);
}
