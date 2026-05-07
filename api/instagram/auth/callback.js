/**
 * GET /api/instagram/auth/callback
 *
 * Instagram redirects here with ?code=... &state=... after the merchant
 * approves. We:
 *   1. Verify state matches the CSRF token we stored on /install (or fail).
 *   2. Exchange code → short-lived token.
 *   3. Exchange short-lived → long-lived (60-day) token.
 *   4. Fetch IG profile to capture username + IG user ID.
 *   5. Save the connection in KV.
 *   6. Redirect back to /admin/instagram with a flash query param.
 *
 * NOT admin-gated: the user comes from instagram.com, not the admin UI,
 * so they may not have the admin cookie attached. The CSRF state token
 * + the OAuth code (one-time, single-use, scoped to our app) provide the
 * security here, the same way Shopify's auth/callback works.
 */

import {
  consumeInstallState,
  exchangeCodeForShortToken,
  exchangeForLongLivedToken,
  fetchProfile,
  saveConnection,
  buildRedirectUri,
} from '../../../lib/instagram-auth.mjs';

function flashRedirect(res, status, message) {
  const url = `/admin/instagram?ig=${status}&msg=${encodeURIComponent(message)}`;
  res.redirect(302, url);
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query || {};

  if (error) {
    return flashRedirect(res, 'error', error_description || error);
  }
  if (!code || !state) {
    return flashRedirect(res, 'error', 'Missing code or state from Instagram');
  }

  try {
    const stateData = await consumeInstallState(state);
    if (!stateData) {
      return flashRedirect(res, 'error', 'Invalid or expired state. Try connecting again.');
    }

    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) {
      return flashRedirect(res, 'error', 'Server config missing META_APP_ID or META_APP_SECRET');
    }

    const redirectUri = buildRedirectUri(req);

    const shortRes = await exchangeCodeForShortToken({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });
    const shortToken = shortRes.access_token;
    if (!shortToken) {
      return flashRedirect(res, 'error', 'No access token returned from Instagram');
    }

    const longRes = await exchangeForLongLivedToken({
      clientSecret,
      shortToken,
    });
    const longToken = longRes.access_token;
    const expiresIn = longRes.expires_in;
    if (!longToken) {
      return flashRedirect(res, 'error', 'No long-lived token returned');
    }

    const profile = await fetchProfile(longToken);
    if (profile.account_type === 'PERSONAL') {
      return flashRedirect(
        res,
        'error',
        'Your IG account is set to Personal. Switch to a Business or Creator account in Instagram, then reconnect.'
      );
    }

    await saveConnection({
      accessToken: longToken,
      expiresIn,
      igUserId: profile.id,
      username: profile.username,
      accountType: profile.account_type,
    });

    return flashRedirect(res, 'connected', `Connected as @${profile.username}`);
  } catch (err) {
    console.error('IG callback error:', err);
    return flashRedirect(res, 'error', err.message || 'Connection failed');
  }
}
