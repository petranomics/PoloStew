/**
 * Product Sale Price Endpoint
 * PUT /api/products/sale-price
 * Sets sale price for a specific product size
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
    const { productId, sku, salePrice } = req.body;

    if (!productId || !sku || salePrice === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'sku', 'salePrice']
      });
    }

    // Read products.json
    const productsPath = join(process.cwd(), 'data', 'products.json');
    const data = JSON.parse(readFileSync(productsPath, 'utf8'));

    // Find product
    const product = data.products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Find size
    const size = product.sizes.find(s => s.sku === sku);

    if (!size) {
      return res.status(404).json({ error: 'Size not found' });
    }

    // Validate sale price
    const salePriceNum = parseInt(salePrice);
    if (salePriceNum >= size.price) {
      return res.status(400).json({
        error: 'Sale price must be less than regular price',
        regularPrice: size.price,
        salePrice: salePriceNum
      });
    }

    // Set sale price
    if (salePriceNum > 0) {
      size.salePrice = salePriceNum;
    } else {
      delete size.salePrice;
    }

    // Write back to file
    writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf8');

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
