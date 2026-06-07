/**
 * Product Sale Toggle Endpoint
 * PUT /api/products/sale
 * Toggles sale status for a product. Persists to KV (published:products);
 * filesystem writes would EROFS in the Vercel runtime.
 * Requires admin authentication.
 */

import { parseCookies, verifyAuth, verifyAdmin } from '../middleware/auth.js';
import { loadProducts, saveProducts } from '../../lib/products-store.mjs';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const adminResult = await verifyAdmin(req, res);
  if (adminResult !== true) return;

  try {
    const { productId, onSale } = req.body;

    if (!productId || typeof onSale !== 'boolean') {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'onSale']
      });
    }

    const products = await loadProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    product.onSale = onSale;

    if (!onSale && Array.isArray(product.sizes)) {
      product.sizes.forEach(size => {
        delete size.salePrice;
      });
    }

    await saveProducts(products);

    return res.status(200).json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        onSale: product.onSale
      }
    });

  } catch (error) {
    console.error('Sale toggle error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
