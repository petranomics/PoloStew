/**
 * POST /api/admin/publish — admin pushes the live product catalog to KV.
 *
 * Body: { products: [...] } — the full array (replace, not merge).
 * Stored at key `published:products`. Read by /api/products as the
 * source of truth, with the data/products.json file as a fallback when
 * nothing has been published yet.
 *
 * Auth: gated by the admin password (see lib/admin-auth.mjs).
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  const { products } = req.body || {};
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Body must be { products: [...] }' });
  }

  // Normalize each product so public consumers see a consistent shape:
  //  - id is always a string (cards URL-encode it; product page string-compares it)
  //  - basePrice + price both populated (admin saves `price`, public reads `basePrice`)
  const normalized = products.map((p) => {
    const out = { ...p };
    out.id = String(p.id);
    if (out.basePrice == null && out.price != null) out.basePrice = out.price;
    if (out.price == null && out.basePrice != null) out.price = out.basePrice;
    return out;
  });

  try {
    await kv.set('published:products', { products: normalized, publishedAt: new Date().toISOString() });
    return res.status(200).json({ success: true, count: normalized.length });
  } catch (error) {
    console.error('Publish error:', error);
    return res.status(500).json({ error: error.message });
  }
}
