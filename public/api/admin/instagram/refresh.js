/**
 * POST /api/admin/instagram/refresh
 *
 * Fetches the merchant's latest 6 IG posts via Graph API and returns them
 * in the tile shape the admin UI expects ({image, link}). The admin can
 * review/edit before clicking Save (which goes to /api/admin/instagram/publish).
 *
 * We DON'T auto-save the tiles here — keep the merchant in control of what
 * shows up on their homepage. The merchant clicks Save manually.
 *
 * Admin-only.
 */

import { getValidAccessToken, fetchRecentMedia } from '../../../lib/instagram-auth.mjs';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  try {
    let accessToken;
    try {
      accessToken = await getValidAccessToken();
    } catch (e) {
      return res.status(412).json({
        error: 'Instagram not connected. Click "Connect Instagram" first.',
      });
    }

    const media = await fetchRecentMedia(accessToken, 6);

    const tiles = media.map((m) => {
      // VIDEO posts use thumbnail_url; image/carousel use media_url.
      const image = (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) || m.media_url || '';
      return {
        image,
        link: m.permalink || '',
        caption: m.caption || '',
        mediaType: m.media_type || '',
        timestamp: m.timestamp || '',
      };
    }).filter((t) => t.image);

    return res.status(200).json({ tiles, count: tiles.length });
  } catch (error) {
    console.error('IG refresh error:', error);
    return res.status(500).json({ error: error.message || 'Refresh failed' });
  }
}
