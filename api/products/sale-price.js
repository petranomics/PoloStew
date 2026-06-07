/**
 * Product Sale Price Endpoint
 * PUT /api/products/sale-price
 * Sets sale price for a specific product size. Persists to KV
 * (published:products); filesystem writes would EROFS in the Vercel runtime.
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
    const { productId, sku, salePrice } = req.body;

    if (!productId || !sku || salePrice === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'sku', 'salePrice']
      });
    }

    const products = await loadProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const size = (product.sizes || []).find(s => s.sku === sku);

    if (!size) {
      return res.status(404).json({ error: 'Size not found' });
    }

    const salePriceNum = parseInt(salePrice);
    if (salePriceNum >= size.price) {
      return res.status(400).json({
        error: 'Sale price must be less than regular price',
        regularPrice: size.price,
        salePrice: salePriceNum
      });
    }

    if (salePriceNum > 0) {
      size.salePrice = salePriceNum;
    } else {
      delete size.salePrice;
    }

    await saveProducts(products);

    return res.status(200).json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        sku,
        price: size.price,
        salePrice: size.salePrice || null,
        discount: size.salePrice ? Math.round(((size.price - size.salePrice) / size.price) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Sale price error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
