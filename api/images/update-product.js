/**
 * Update Product Images Endpoint
 * PUT /api/images/update-product
 * Updates the images array for a specific product
 * Requires admin authentication
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseCookies, verifyAuth, verifyAdmin } from '../middleware/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const adminResult = await verifyAdmin(req, res);
  if (adminResult !== true) return;

  try {
    const { productId, images, action } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    // Read products.json
    const productsPath = join(process.cwd(), 'data', 'products.json');
    const data = JSON.parse(readFileSync(productsPath, 'utf8'));

    // Find product
    const product = data.products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update images based on action
    switch (action) {
      case 'set':
        // Replace all images
        if (!Array.isArray(images)) {
          return res.status(400).json({ error: 'Images must be an array' });
        }
        product.images = images;
        break;

      case 'add':
        // Add new image
        if (typeof images === 'string') {
          product.images = product.images || [];
          product.images.push(images);
        } else if (Array.isArray(images)) {
          product.images = product.images || [];
          product.images.push(...images);
        }
        break;

      case 'remove':
        // Remove image by URL
        if (typeof images === 'string') {
          product.images = (product.images || []).filter(img => img !== images);
        } else if (Array.isArray(images)) {
          product.images = (product.images || []).filter(img => !images.includes(img));
        }
        break;

      case 'reorder':
        // Reorder images
        if (!Array.isArray(images)) {
          return res.status(400).json({ error: 'Images must be an array for reorder' });
        }
        product.images = images;
        break;

      default:
        return res.status(400).json({
          error: 'Invalid action',
          allowed: ['set', 'add', 'remove', 'reorder']
        });
    }

    // Write back to file
    writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf8');

    return res.status(200).json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        images: product.images
      }
    });

  } catch (error) {
    console.error('Update product images error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
