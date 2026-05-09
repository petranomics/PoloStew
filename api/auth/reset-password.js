/**
 * Reset Password Endpoint
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }
 *
 * Validates the token from KV (`reset:{token}`), enforces password length >= 8,
 * updates the user's bcrypt-hashed password, and burns the token.
 */

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, newPassword } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token required', code: 'TOKEN_REQUIRED' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const record = await kv.get(`reset:${token}`);
    if (!record || !record.userId) {
      return res.status(400).json({
        error: 'This reset link is invalid or has expired. Please request a new one.',
        code: 'TOKEN_INVALID'
      });
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      await kv.del(`reset:${token}`);
      return res.status(400).json({
        error: 'This reset link has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED'
      });
    }

    const user = await kv.get(`user:${record.userId}`);
    if (!user) {
      await kv.del(`reset:${token}`);
      return res.status(400).json({
        error: 'Account not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordUpdatedAt = new Date().toISOString();
    await kv.set(`user:${record.userId}`, user);

    // Burn the token so it can't be reused
    await kv.del(`reset:${token}`);

    return res.status(200).json({
      success: true,
      message: 'Your password has been reset. You can now log in with the new one.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
