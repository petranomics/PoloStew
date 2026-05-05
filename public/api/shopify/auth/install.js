import crypto from 'crypto';
import {
  SHOPIFY_SCOPES,
  isValidShopHostname,
  saveInstallState,
} from '../../../lib/shopifyAuth.mjs';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const shop = req.query.shop || process.env.SHOPIFY_STORE_URL;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'SHOPIFY_CLIENT_ID not configured' });
  }
  if (!isValidShopHostname(shop)) {
    return res.status(400).json({
      error: 'Missing or invalid shop. Pass ?shop=<store>.myshopify.com or set SHOPIFY_STORE_URL env var.',
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  await saveInstallState(state, shop);

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = `${proto}://${host}/api/shopify/auth/callback`;

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', SHOPIFY_SCOPES.join(','));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  res.redirect(302, url.toString());
}
