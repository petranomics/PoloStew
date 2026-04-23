/**
 * Public Products API
 * GET /api/products - Get all products or single product
 * Returns product data with sizes and inventory
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read products from JSON file
    const productsPath = join(process.cwd(), 'data', 'products.json');
    const productsData = readFileSync(productsPath, 'utf8');
    const { products } = JSON.parse(productsData);

    // If product ID is provided, return single product
    const { id } = req.query;
    if (id) {
      const product = products.find(p => p.id === id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.status(200).json({ product });
    }

    // Return all products
    return res.status(200).json({ products });

  } catch (error) {
    console.error('Products API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
