/**
 * POST /api/admin/publish — admin pushes the live product catalog to KV.
 *
 * Body: { products: [...] } — the full array (replace, not merge).
 * Stored at key `published:products`. Read by /api/products as the
 * source of truth, with the data/products.json file as a fallback when
 * nothing has been published yet.
 *
 * Auth: open for now to match the rest of admin (admin UI itself has no
 * login gate today — see project_api_auth_needed memory). Tighten before
 * public launch.
 */

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { products } = req.body || {};
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Body must be { products: [...] }' });
  }

  try {
    await kv.set('published:products', { products, publishedAt: new Date().toISOString() });
    return res.status(200).json({ success: true, count: products.length });
  } catch (error) {
    console.error('Publish error:', error);
    return res.status(500).json({ error: error.message });
  }
}
