/**
 * User Login Endpoint
 * POST /api/auth/login
 */

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { parseCookies, setCookie } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export default async function handler(req, res) {
  // Parse cookies
  parseCookies(req);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, rememberMe } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Get user by email
    const emailLower = email.toLowerCase();
    const userId = await kv.get(`user:email:${emailLower}`);

    if (!userId) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = await kv.get(`user:${userId}`);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Optional: Check email verification
    // if (!user.emailVerified) {
    //   return res.status(403).json({
    //     error: 'Please verify your email before logging in',
    //     code: 'EMAIL_NOT_VERIFIED'
    //   });
    // }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      JWT_SECRET,
      { expiresIn: rememberMe ? '30d' : REFRESH_TOKEN_EXPIRES_IN }
    );

    // Create session
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId: user.id,
      refreshToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
      ).toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
    };

    // Store session in KV with TTL
    const sessionTTL = rememberMe ? 2592000 : 604800; // 30d or 7d in seconds
    await kv.set(`session:${sessionId}`, session, { ex: sessionTTL });

    // Set HTTP-only cookies
    setCookie(res, 'accessToken', accessToken, { maxAge: 900 }); // 15min
    setCookie(res, 'refreshToken', refreshToken, { maxAge: sessionTTL });
    setCookie(res, 'sessionId', sessionId, { maxAge: sessionTTL });

    // Return user data
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        emailVerified: user.emailVerified
      },
      accessToken // Also return in body for client-side storage if needed
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
