/**
 * Inventory Update Endpoint
 * POST /api/inventory/update
 * Updates stock levels for product sizes
 * Requires admin authentication
 */

import { kv } from '@vercel/kv';
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
    const { productId, sku, quantity, operation } = req.body;

    if (!productId || !sku || quantity === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'sku', 'quantity']
      });
    }

    // Get current inventory from KV
    const inventoryKey = `inventory:${productId}:${sku}`;
    let currentStock = await kv.get(inventoryKey) || 0;

    // Update stock based on operation
    let newStock;
    switch (operation) {
      case 'set':
        newStock = parseInt(quantity);
        break;
      case 'increment':
        newStock = currentStock + parseInt(quantity);
        break;
      case 'decrement':
        newStock = Math.max(0, currentStock - parseInt(quantity));
        break;
      default:
        newStock = parseInt(quantity);
    }

    // Save to KV
    await kv.set(inventoryKey, newStock);

    // Log inventory change
    const logKey = `inventory:log:${Date.now()}`;
    await kv.set(logKey, {
      productId,
      sku,
      oldStock: currentStock,
      newStock,
      operation,
      quantity,
      adminId: req.user.id,
      timestamp: new Date().toISOString()
    }, { ex: 2592000 }); // Expire after 30 days

    return res.status(200).json({
      success: true,
      productId,
      sku,
      previousStock: currentStock,
      currentStock: newStock
    });

  } catch (error) {
    console.error('Inventory update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
