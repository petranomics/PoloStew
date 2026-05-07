/**
 * POST /api/instagram/auth/disconnect
 *
 * Clears the IG connection. Doesn't revoke the token on Meta's side
 * (Meta doesn't expose a revoke endpoint for ig_business_basic) — but
 * dropping it from KV means we'll never use it again, and the merchant
 * can revoke from Instagram's own settings if they want belt-and-suspenders.
 *
 * Admin-only.
 */

import { clearConnection } from '../../../lib/instagram-auth.mjs';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  try {
    await clearConnection();
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('IG disconnect error:', e);
    return res.status(500).json({ error: 'Disconnect failed' });
  }
}
