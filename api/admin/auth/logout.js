/**
 * POST /api/admin/auth/logout
 * Clears the admin session cookie. Always returns 200.
 */

import { clearSessionCookie } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
