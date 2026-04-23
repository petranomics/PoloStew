/**
 * Admin Products Management Endpoint
 * GET/POST/PUT/DELETE /api/admin/products
 * Requires admin authentication
 */

import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import { parseCookies, verifyAuth, verifyAdmin } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Parse cookies, verify auth, then verify admin
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const adminResult = await verifyAdmin(req, res);
  if (adminResult !== true) return;

  // GET - List all products
  if (req.method === 'GET') {
    try {
      // Get all product keys
      const productKeys = [];
      let cursor = '0';

      // Scan for all product keys
      do {
        const result = await kv.scan(cursor, {
          match: 'product:*',
          count: 100
        });
        cursor = result[0];
        productKeys.push(...result[1]);
      } while (cursor !== '0');

      // Get all products
      const products = [];
      for (const key of productKeys) {
        const product = await kv.get(key);
        if (product) products.push(product);
      }

      return res.status(200).json({
        products,
        count: products.length
      });

    } catch (error) {
      console.error('Products GET error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - Create new product
  if (req.method === 'POST') {
    try {
      const { name, brand, category, price, description, image, stock } = req.body;

      if (!name || !brand || !category || !price) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'brand', 'category', 'price']
        });
      }

      const productId = uuidv4();
      const product = {
        id: productId,
        name,
        brand,
        category,
        price: parseFloat(price),
        description: description || '',
        image: image || '',
        stock: stock || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`product:${productId}`, product);

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product
      });

    } catch (error) {
      console.error('Product POST error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT - Update product
  if (req.method === 'PUT') {
    try {
      const { productId, ...updates } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      const product = await kv.get(`product:${productId}`);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Update fields
      Object.assign(product, updates);
      product.updatedAt = new Date().toISOString();

      await kv.set(`product:${productId}`, product);

      return res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        product
      });

    } catch (error) {
      console.error('Product PUT error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE - Remove product
  if (req.method === 'DELETE') {
    try {
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      const product = await kv.get(`product:${productId}`);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      await kv.del(`product:${productId}`);

      return res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error) {
      console.error('Product DELETE error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
