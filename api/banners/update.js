/**
 * Banner Update Endpoint
 * PUT /api/banners/update
 * Updates banner configuration in KV (`banners:list`).
 * Requires admin authentication.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../lib/admin-auth.mjs';

const KV_KEY = 'banners:list';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  try {
    const { banners } = req.body;

    if (!Array.isArray(banners)) {
      return res.status(400).json({
        error: 'Invalid data format',
        required: 'banners array'
      });
    }

    for (const banner of banners) {
      if (!banner.id || !banner.title) {
        return res.status(400).json({
          error: 'Invalid banner structure',
          required: ['id', 'title', 'subtitle', 'buttonText', 'buttonLink']
        });
      }
    }

    await kv.set(KV_KEY, { banners, updatedAt: new Date().toISOString() });

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
