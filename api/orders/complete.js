/**
 * Order Completion Endpoint
 * POST /api/orders/complete
 * Processes order and deducts inventory
 * Requires authentication
 */

import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import { parseCookies, verifyAuth } from '../middleware/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  try {
    const { items, shippingAddress, paymentMethod, total } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['items', 'shippingAddress', 'paymentMethod']
      });
    }

    // Validate inventory availability for all items first
    const inventoryChecks = [];
    for (const item of items) {
      const inventoryKey = `inventory:${item.id}:${item.sku}`;
      const stock = await kv.get(inventoryKey);

      if (stock === null) {
        return res.status(400).json({
          error: 'Inventory not found',
          item: item.name,
          message: 'Please contact support'
        });
      }

      if (stock < item.quantity) {
        return res.status(400).json({
          error: 'Insufficient stock',
          item: item.name,
          size: item.size,
          available: stock,
          requested: item.quantity
        });
      }

      inventoryChecks.push({
        inventoryKey,
        currentStock: stock,
        quantity: item.quantity,
        item
      });
    }

    // All items available - proceed with order
    const orderId = uuidv4();
    const order = {
      id: orderId,
      userId: req.user.id,
      items: items.map(item => ({
        productId: item.id,
        name: item.name,
        brand: item.brand,
        size: item.size,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity
      })),
      shippingAddress,
      paymentMethod,
      total,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    // Save order to KV
    await kv.set(`order:${orderId}`, order);

    // Add to user's orders list
    const userOrdersKey = `user:orders:${req.user.id}`;
    const userOrders = await kv.get(userOrdersKey) || [];
    userOrders.unshift(orderId);
    await kv.set(userOrdersKey, userOrders);

    // Deduct inventory for each item
    for (const check of inventoryChecks) {
      const newStock = check.currentStock - check.quantity;
      await kv.set(check.inventoryKey, newStock);

      // Log inventory deduction
      const logKey = `inventory:log:${Date.now()}-${Math.random()}`;
      await kv.set(logKey, {
        productId: check.item.id,
        sku: check.item.sku,
        oldStock: check.currentStock,
        newStock,
        operation: 'sale',
        quantity: check.quantity,
        orderId,
        userId: req.user.id,
        timestamp: new Date().toISOString()
      }, { ex: 2592000 }); // Expire after 30 days
    }

    return res.status(200).json({
      success: true,
      orderId,
      message: 'Order placed successfully',
      order
    });

  } catch (error) {
    console.error('Order completion error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
