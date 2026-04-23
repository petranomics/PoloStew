/**
 * Inventory Check Endpoint
 * GET /api/inventory/check?productId=xxx&sku=xxx
 * Returns current stock level for a specific product size
 */

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productId, sku } = req.query;

    if (!productId || !sku) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['productId', 'sku']
      });
    }

    // Get stock from KV
    const inventoryKey = `inventory:${productId}:${sku}`;
    const stock = await kv.get(inventoryKey);

    if (stock === null) {
      return res.status(404).json({
        error: 'Inventory record not found',
        message: 'Please sync inventory first'
      });
    }

    return res.status(200).json({
      productId,
      sku,
      stock,
      inStock: stock > 0
    });

  } catch (error) {
    console.error('Inventory check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
