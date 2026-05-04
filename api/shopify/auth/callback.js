import {
  consumeInstallState,
  isValidShopHostname,
  setShopifyToken,
  verifyShopifyHmac,
} from '../../../lib/shopifyAuth.mjs';

export default async function handler(req, res) {
  const { code, hmac, shop, state } = req.query;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Shopify env vars not configured' });
  }
  if (!code || !hmac || !shop || !state) {
    return res.status(400).json({ error: 'Missing required OAuth params' });
  }
  if (!isValidShopHostname(shop)) {
    return res.status(400).json({ error: 'Invalid shop hostname' });
  }
  if (!verifyShopifyHmac(req.query, clientSecret)) {
    return res.status(401).json({ error: 'HMAC verification failed' });
  }
  const expectedShop = await consumeInstallState(state);
  if (!expectedShop || expectedShop !== shop) {
    return res.status(401).json({ error: 'Invalid or expired install state' });
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('Shopify token exchange failed:', tokenRes.status, text);
    return res
      .status(500)
      .send(`<h1>Shopify install failed</h1><p>Status ${tokenRes.status}</p><pre>${text.slice(0, 1000)}</pre>`);
  }

  const data = await tokenRes.json();
  if (!data.access_token) {
    return res.status(500).json({ error: 'No access_token in Shopify response' });
  }

  await setShopifyToken(shop, data.access_token);

  res.redirect(302, '/admin?shopify=connected');
}
