/**
 * Update Product Images Endpoint
 * PUT /api/images/update-product
 * Updates the images array for a specific product. Persists to KV
 * (published:products); filesystem writes would EROFS in the Vercel runtime.
 * Requires admin authentication.
 */

import { requireAdmin } from '../../lib/admin-auth.mjs';
import { loadProducts, saveProducts } from '../../lib/products-store.mjs';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  try {
    const { productId, images, action } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    const products = await loadProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    switch (action) {
      case 'set':
        if (!Array.isArray(images)) {
          return res.status(400).json({ error: 'Images must be an array' });
        }
        product.images = images;
        break;

      case 'add':
        if (typeof images === 'string') {
          product.images = product.images || [];
          product.images.push(images);
        } else if (Array.isArray(images)) {
          product.images = product.images || [];
          product.images.push(...images);
        }
        break;

      case 'remove':
        if (typeof images === 'string') {
          product.images = (product.images || []).filter(img => img !== images);
        } else if (Array.isArray(images)) {
          product.images = (product.images || []).filter(img => !images.includes(img));
        }
        break;

      case 'reorder':
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

    await saveProducts(products);

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
