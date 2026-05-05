/**
 * POST /api/admin/instagram/publish
 *
 * Body: { handle, profileUrl, tiles: [{image, link?}] }
 * Stored at KV key `published:instagram`. Read by /api/instagram.
 *
 * Auth: open for now to match the rest of admin (admin UI itself has no
 * login gate today — see project_api_auth_needed). Tighten before launch.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  const { handle, profileUrl, tiles } = req.body || {};
  if (!Array.isArray(tiles)) {
    return res.status(400).json({ error: 'Body must include tiles: [...]' });
  }

  const cleanedHandle = String(handle || '').replace(/^@/, '').trim();
  const normalizedTiles = tiles
    .filter((t) => t && typeof t.image === 'string' && t.image.length > 0)
    .slice(0, 6)
    .map((t) => ({ image: t.image, link: t.link || '' }));

  try {
    await kv.set('published:instagram', {
      handle: cleanedHandle,
      profileUrl: profileUrl || (cleanedHandle ? `https://instagram.com/${cleanedHandle}` : ''),
      tiles: normalizedTiles,
      publishedAt: new Date().toISOString(),
    });
    return res.status(200).json({ success: true, count: normalizedTiles.length });
  } catch (error) {
    console.error('Instagram publish error:', error);
    return res.status(500).json({ error: error.message });
  }
}
