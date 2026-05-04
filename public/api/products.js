/**
 * Public Products API
 * GET /api/products            -> { products: [...] }
 * GET /api/products?id=<id>    -> { product: {...} }
 *
 * Source of truth is KV (key `published:products`), populated by the admin
 * via /api/admin/publish. If KV is empty (first-time setup, fresh deploy),
 * fall back to data/products.json so the site isn't empty.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';

async function loadProducts() {
  const published = await kv.get('published:products');
  if (published && Array.isArray(published.products) && published.products.length > 0) {
    return published.products;
  }
  const path = join(process.cwd(), 'data', 'products.json');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  return file.products || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const products = await loadProducts();

    const { id } = req.query;
    if (id) {
      const product = products.find((p) => String(p.id) === String(id));
      if (!product) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json({ product });
    }

    return res.status(200).json({ products });
  } catch (error) {
    console.error('Products API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
