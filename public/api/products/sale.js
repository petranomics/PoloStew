/**
 * Product Sale Toggle Endpoint
 * PUT /api/products/sale
 * Toggles sale status for a product
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
    const { productId, onSale } = req.body;

    if (!productId || typeof onSale !== 'boolean') {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'onSale']
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

    // Update sale status
    product.onSale = onSale;

    // If turning off sale, remove salePrice from all sizes
    if (!onSale) {
      product.sizes.forEach(size => {
        delete size.salePrice;
      });
    }

    // Write back to file
    writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf8');

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
