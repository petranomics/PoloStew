/**
 * Forgot Password Endpoint
 * POST /api/auth/forgot-password
 *
 * Body: { email }
 *
 * Always returns 200 — we don't leak whether an account exists. If the email
 * matches a real user, we generate a reset token (uuid), store it in KV under
 * `reset:{token}` with TTL=1h, and send the reset email.
 */

import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import { sendPasswordResetEmail } from '../../lib/email.mjs';

const RESET_TTL_SECONDS = 60 * 60; // 1 hour

const GENERIC_OK = {
  success: true,
  message: 'If an account exists for that email, a reset link is on its way.'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      // Still respond OK to avoid leaking existence
      return res.status(200).json(GENERIC_OK);
    }

    const emailLower = email.toLowerCase().trim();
    const userId = await kv.get(`user:email:${emailLower}`);

    if (!userId) {
      return res.status(200).json(GENERIC_OK);
    }

    const user = await kv.get(`user:${userId}`);
    if (!user) {
      return res.status(200).json(GENERIC_OK);
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + RESET_TTL_SECONDS * 1000).toISOString();

    await kv.set(
      `reset:${resetToken}`,
      { userId, email: emailLower, expiresAt },
      { ex: RESET_TTL_SECONDS }
    );

    const resetUrl = `https://polostew.com/reset-password?token=${encodeURIComponent(resetToken)}`;
    const firstName = user.profile && user.profile.firstName;

    const emailResult = await sendPasswordResetEmail(emailLower, firstName, resetUrl);
    if (!emailResult.ok) {
      console.warn('[forgot-password] reset email send failed for', emailLower);
    }

    return res.status(200).json(GENERIC_OK);

  } catch (error) {
    console.error('Forgot password error:', error);
    // Even on error, don't leak. Return generic OK.
    return res.status(200).json(GENERIC_OK);
  }
}
