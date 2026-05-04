/**
 * Shopify OAuth 2.0 client credentials grant helper.
 *
 * Apps created via the new Dev Dashboard (post-Jan-2026) issue Client ID +
 * Client Secret instead of a static `shpat_` token. We exchange them for an
 * Admin API access token that's valid for 24 hours, then cache it in module
 * memory so we don't hit the auth endpoint on every API call.
 */

let cached = null; // { token: string, expiresAt: number }

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

export async function getShopifyAccessToken() {
  const shop = process.env.SHOPIFY_STORE_URL;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shop || !clientId || !clientSecret) {
    throw new Error('Shopify not configured. Set SHOPIFY_STORE_URL, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.');
  }

  if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Shopify token response missing access_token');
  }

  const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 24 * 60 * 60;
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  return cached.token;
}
