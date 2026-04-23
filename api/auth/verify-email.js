/**
 * Email Verification Endpoint
 * GET /api/auth/verify-email?token=xxx
 */

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Get userId from verification token
    const userId = await kv.get(`user:verification:${token}`);

    if (!userId) {
      // Redirect to login with error
      return res.redirect(302, '/login.html?error=invalid_token');
    }

    // Get user
    const user = await kv.get(`user:${userId}`);

    if (!user) {
      return res.redirect(302, '/login.html?error=user_not_found');
    }

    // Update user
    user.emailVerified = true;
    user.verificationToken = null;
    await kv.set(`user:${userId}`, user);

    // Delete verification token
    await kv.del(`user:verification:${token}`);

    // Redirect to login with success message
    return res.redirect(302, '/login.html?verified=true');

  } catch (error) {
    console.error('Email verification error:', error);
    return res.redirect(302, '/login.html?error=verification_failed');
  }
}
