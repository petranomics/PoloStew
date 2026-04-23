/**
 * Banner Update Endpoint
 * PUT /api/banners/update
 * Updates banner configuration
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
    const { banners } = req.body;

    if (!Array.isArray(banners)) {
      return res.status(400).json({
        error: 'Invalid data format',
        required: 'banners array'
      });
    }

    // Validate banner structure
    for (const banner of banners) {
      if (!banner.id || !banner.title) {
        return res.status(400).json({
          error: 'Invalid banner structure',
          required: ['id', 'title', 'subtitle', 'buttonText', 'buttonLink']
        });
      }
    }

    // Read current data
    const bannersPath = join(process.cwd(), 'data', 'banners.json');
    const data = { banners };

    // Write updated data
    writeFileSync(bannersPath, JSON.stringify(data, null, 2), 'utf8');

    return res.status(200).json({
      success: true,
      bannersUpdated: banners.length
    });

  } catch (error) {
    console.error('Banner update error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
