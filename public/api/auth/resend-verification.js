/**
 * Resend Verification Email Endpoint
 * POST /api/auth/resend-verification
 *
 * Requires a logged-in session (accessToken cookie or Authorization header).
 * Generates a fresh verify token, stores it in KV with 24h TTL, and sends
 * the verification email. No-ops cleanly if user is already verified.
 */

import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { parseCookies } from '../middleware/auth.js';
import { sendVerificationEmail } from '../../lib/email.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const VERIFY_TTL_SECONDS = 24 * 60 * 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    parseCookies(req);
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session', code: 'INVALID_TOKEN' });
    }

    const user = await kv.get(`user:${decoded.userId}`);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Your email is already verified.'
      });
    }

    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + VERIFY_TTL_SECONDS * 1000).toISOString();

    await kv.set(
      `verify:${verificationToken}`,
      { userId: user.id, email: user.email, expiresAt },
      { ex: VERIFY_TTL_SECONDS }
    );

    const verifyUrl = `https://polostew.com/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const firstName = user.profile && user.profile.firstName;
    const result = await sendVerificationEmail(user.email, firstName, verifyUrl);

    if (!result.ok) {
      return res.status(502).json({ error: 'Could not send email. Please try again later.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification email sent. Check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
