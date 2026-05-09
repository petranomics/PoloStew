/**
 * User Registration Endpoint
 * POST /api/auth/register
 *
 * Creates the user, then fires off a verification email via Resend.
 * The user can log in immediately — verification is non-blocking; UI shows a banner.
 */

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sendVerificationEmail } from '../../lib/email.mjs';

const VERIFY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'firstName', 'lastName']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if user already exists
    const emailLower = email.toLowerCase();
    const existingUserId = await kv.get(`user:email:${emailLower}`);

    if (existingUserId) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate IDs and tokens
    const userId = uuidv4();
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + VERIFY_TTL_SECONDS * 1000).toISOString();

    // Create user object — verification is async; mark unverified
    const user = {
      id: userId,
      email: emailLower,
      passwordHash,
      role: 'user',
      profile: {
        firstName,
        lastName,
        phone: null
      },
      addresses: [],
      paymentMethods: [],
      wishlist: [],
      orderHistory: [],
      createdAt: new Date().toISOString(),
      emailVerified: false,
      verificationToken: null
    };

    // Store user in Vercel KV
    await kv.set(`user:${userId}`, user);
    await kv.set(`user:email:${emailLower}`, userId);

    // Store verification token with TTL
    await kv.set(
      `verify:${verificationToken}`,
      { userId, email: emailLower, expiresAt },
      { ex: VERIFY_TTL_SECONDS }
    );

    // Build verify URL — prefer explicit prod host
    const verifyUrl = `https://polostew.com/verify-email?token=${encodeURIComponent(verificationToken)}`;

    // Fire-and-await — email helper never throws
    const emailResult = await sendVerificationEmail(emailLower, firstName, verifyUrl);
    if (!emailResult.ok) {
      console.warn('[register] verification email send failed for', emailLower);
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      userId,
      user: {
        id: userId,
        email: emailLower,
        firstName,
        lastName,
        emailVerified: false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
