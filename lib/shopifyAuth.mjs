/**
 * Shopify auth helpers — authorization code grant flow.
 *
 * The merchant clicks an install link, approves scopes on their store, Shopify
 * redirects back to /api/shopify/auth/callback with a one-time `code`, we
 * exchange that for a permanent offline access token and store it in Vercel KV
 * keyed by shop domain. All future API calls read the token from KV.
 *
 * This is the path Shopify recommends for any merchant store outside the same
 * Dev Dashboard organization as the app — client_credentials only works for
 * stores owned by the same org.
 */

import { kv } from '@vercel/kv';
import crypto from 'crypto';

export const SHOPIFY_SCOPES = [
  'read_products',
  'read_inventory',
  'read_orders',
  'read_customers',
];

const tokenKey = (shop) => `shopify:token:${shop}`;
const stateKey = (state) => `shopify:install:state:${state}`;

export async function setShopifyToken(shop, token) {
  await kv.set(tokenKey(shop), token);
}

export async function getShopifyToken(shop) {
  return await kv.get(tokenKey(shop));
}

export async function saveInstallState(state, shop) {
  await kv.set(stateKey(state), shop, { ex: 600 }); // 10 min TTL
}

export async function consumeInstallState(state) {
  const shop = await kv.get(stateKey(state));
  if (shop) await kv.del(stateKey(state));
  return shop;
}

export function isValidShopHostname(shop) {
  return typeof shop === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export function verifyShopifyHmac(query, clientSecret) {
  const params = { ...query };
  const hmac = params.hmac;
  delete params.hmac;
  delete params.signature;
  if (!hmac || typeof hmac !== 'string') return false;

  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const computed = crypto.createHmac('sha256', clientSecret).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(computed, 'utf8'));
  } catch {
    return false;
  }
}
