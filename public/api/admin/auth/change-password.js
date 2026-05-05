/**
 * POST /api/admin/auth/change-password
 * Body: { current, next }
 * Requires admin session AND correct current password. Stores bcrypt hash.
 *
 * Existing sessions remain valid until JWT expiry — that's intentional so
 * the merchant doesn't get logged out of the tab they're using to change it.
 */

import { requireAdmin, verifyPassword, setPassword } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req, res))) return;

  const { current, next } = req.body || {};
  if (!current || !next) {
    return res.status(400).json({ error: 'Both current and next passwords required' });
  }
  if (typeof next !== 'string' || next.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const ok = await verifyPassword(current);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await setPassword(next);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: error.message || 'Change password failed' });
  }
}
