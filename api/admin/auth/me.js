/**
 * GET /api/admin/auth/me
 * Returns 200 + { admin: true } if cookie holds a valid admin session.
 * Returns 401 otherwise. Used by admin pages to gate access client-side.
 */

import { readCookie, verifySession } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = readCookie(req);
  if (!verifySession(token)) {
    return res.status(401).json({ admin: false });
  }
  return res.status(200).json({ admin: true });
}
