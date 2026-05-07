/**
 * GET /api/instagram/auth/status
 *
 * Returns connection state for the admin UI. Doesn't expose the token —
 * only public-ish fields (username, account type, expiry).
 *
 * Admin-only.
 */

import { getConnection } from '../../../lib/instagram-auth.mjs';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;

  try {
    const conn = await getConnection();
    if (!conn || !conn.accessToken) {
      return res.status(200).json({ connected: false });
    }
    return res.status(200).json({
      connected: true,
      username: conn.username || null,
      accountType: conn.accountType || null,
      expiresAt: conn.expiresAt || null,
    });
  } catch (e) {
    console.error('IG status error:', e);
    return res.status(500).json({ error: 'Status check failed' });
  }
}
