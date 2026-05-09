/**
 * Email Verification Endpoint
 * GET /api/auth/verify-email?token=xxx
 *
 * Looks up `verify:{token}` in KV. If valid, marks the user emailVerified=true,
 * deletes the token, and redirects to /account?verified=1. Otherwise redirects
 * to /login?verifyError=expired.
 */

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect(302, '/login?verifyError=expired');
    }

    // Look up token in KV — value is { userId, email, expiresAt }
    const record = await kv.get(`verify:${token}`);

    if (!record || !record.userId) {
      return res.redirect(302, '/login?verifyError=expired');
    }

    // Defensive: if expiresAt is in the past, treat as expired even if KV TTL hasn't fired
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      await kv.del(`verify:${token}`);
      return res.redirect(302, '/login?verifyError=expired');
    }

    // Get user
    const user = await kv.get(`user:${record.userId}`);
    if (!user) {
      await kv.del(`verify:${token}`);
      return res.redirect(302, '/login?verifyError=expired');
    }

    // Mark verified
    user.emailVerified = true;
    user.verificationToken = null;
    await kv.set(`user:${record.userId}`, user);

    // Burn the token
    await kv.del(`verify:${token}`);

    return res.redirect(302, '/account?verified=1');

  } catch (error) {
    console.error('Email verification error:', error);
    return res.redirect(302, '/login?verifyError=expired');
  }
}
