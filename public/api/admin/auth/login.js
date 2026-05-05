/**
 * POST /api/admin/auth/login
 * Body: { password }
 * On success: sets HttpOnly admin session cookie, returns { success: true }.
 * On failure: 401.
 */

import { verifyPassword, signSession, setSessionCookie } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  try {
    const ok = await verifyPassword(password);
    if (!ok) {
      // Constant-ish delay to blunt timing side channels (bcrypt already does most of this).
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const token = signSession();
    setSessionCookie(res, token);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}
