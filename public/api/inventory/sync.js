/**
 * Inventory Sync Endpoint
 * POST /api/inventory/sync
 * Syncs product inventory from products.json to Vercel KV
 * Requires admin authentication
 * Run this once to initialize inventory in KV
 */

import { kv } from '@vercel/kv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCookies, verifyAuth, verifyAdmin } from '../middleware/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const adminResult = await verifyAdmin(req, res);
  if (adminResult !== true) return;

  try {
    // Read products from JSON
    const productsPath = join(process.cwd(), 'data', 'products.json');
    const productsData = readFileSync(productsPath, 'utf8');
    const { products } = JSON.parse(productsData);

    let syncedCount = 0;

    // Sync each product's sizes to KV
    for (const product of products) {
      for (const sizeVariant of product.sizes) {
        const inventoryKey = `inventory:${product.id}:${sizeVariant.sku}`;

        // Only set if not already exists (prevents overwriting manual updates)
        const existing = await kv.get(inventoryKey);
        if (existing === null) {
          await kv.set(inventoryKey, sizeVariant.stock);
          syncedCount++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Inventory synced successfully',
      syncedItems: syncedCount,
      totalProducts: products.length
    });

  } catch (error) {
    console.error('Inventory sync error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
