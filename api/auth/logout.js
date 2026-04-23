/**
 * User Logout Endpoint
 * POST /api/auth/logout
 */

import { kv } from '@vercel/kv';
import { parseCookies, clearCookie } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Parse cookies
  parseCookies(req);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.cookies?.sessionId;

    // Delete session from KV if it exists
    if (sessionId) {
      await kv.del(`session:${sessionId}`);
    }

    // Clear all auth cookies
    clearCookie(res, 'accessToken');
    clearCookie(res, 'refreshToken');
    clearCookie(res, 'sessionId');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if KV deletion fails
    clearCookie(res, 'accessToken');
    clearCookie(res, 'refreshToken');
    clearCookie(res, 'sessionId');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
}
