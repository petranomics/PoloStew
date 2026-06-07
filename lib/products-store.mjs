/**
 * Products storage helper — keeps the published-products KV blob in sync.
 *
 * Storage model (must match /api/admin/publish.js):
 *   KV key `published:products` -> { products: [...], publishedAt: ISO }
 *
 * loadProducts() returns the array, preferring KV and falling back to
 * data/products.json on a fresh deploy. saveProducts(arr) writes it back
 * to KV. Filesystem writes are NOT supported in the Vercel runtime, so all
 * mutating endpoints must round-trip through KV — see /api/products/sale.js,
 * sale-price.js, /api/images/update-product.js.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';

export const KV_KEY = 'published:products';

export async function loadProducts() {
  const stored = await kv.get(KV_KEY);
  if (stored && Array.isArray(stored.products)) return stored.products;
  const path = join(process.cwd(), 'data', 'products.json');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(file.products) ? file.products : [];
}

export async function saveProducts(products) {
  await kv.set(KV_KEY, { products, publishedAt: new Date().toISOString() });
}
