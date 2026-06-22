/**
 * POST /api/admin/publish — admin pushes the live product catalog to KV.
 *
 * Body: { products: [...] } — the full array (replace, not merge).
 * Stored at key `published:products`. Read by /api/products as the
 * source of truth, with the data/products.json file as a fallback when
 * nothing has been published yet.
 *
 * Safety: refuses to collapse a real catalog down to a near-empty set (the
 * footgun that wiped the live store to its 10 samples). Pass ?force=1 to
 * override for an intentional bulk delete.
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

  // Guard against accidental catalog wipes: if a sizeable catalog is already
  // published and this request would shrink it to a near-empty set, refuse
  // unless the caller explicitly forces it (?force=1). A real edit keeps the
  // count roughly the same; a wipe drops hundreds of items to ~10.
  const force = req.query?.force === '1' || req.query?.force === 'true';
  if (!force) {
    try {
      const current = await kv.get('published:products');
      const existingCount = (current && Array.isArray(current.products)) ? current.products.length : 0;
      if (existingCount >= 20 && products.length <= 10) {
        return res.status(409).json({
          error: 'Refusing to shrink the live catalog from ' + existingCount + ' to ' +
                 products.length + ' products. This guards against accidental wipes. ' +
                 'Re-send with ?force=1 if this is an intentional bulk delete.',
          code: 'CATALOG_SHRINK_BLOCKED',
          existingCount,
          incomingCount: products.length,
        });
      }
    } catch (e) {
      // If we can't read the current catalog, don't block the write.
      console.warn('Publish guard: could not read current catalog:', e.message);
    }
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
