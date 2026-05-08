/**
 * eBay OAuth client credentials flow — server-to-server.
 * Returns a short-lived application access token (~2 hours).
 *
 * No user OAuth needed: we use the Browse API with a seller filter, which is
 * publicly available with just an App access token. The seller's listings on
 * eBay are public data.
 *
 * Required env vars:
 *   EBAY_APP_ID     — from developer.ebay.com → My Account → Application Keysets
 *   EBAY_CERT_ID    — from the same screen (the "Cert ID" / Client Secret)
 *   EBAY_ENV        — 'production' (default) or 'sandbox'
 */

const tokenCache = { value: null, expiresAt: 0 };

export async function getEbayAppToken() {
  const now = Date.now();
  if (tokenCache.value && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.value;
  }

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) {
    throw new Error('EBAY_APP_ID and EBAY_CERT_ID env vars must be set');
  }

  const env = process.env.EBAY_ENV || 'production';
  const tokenUrl =
    env === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

  const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay token error (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache.value = data.access_token;
  tokenCache.expiresAt = now + data.expires_in * 1000;
  return tokenCache.value;
}

export function getEbayApiBase() {
  const env = process.env.EBAY_ENV || 'production';
  return env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}
