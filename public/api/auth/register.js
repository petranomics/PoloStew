/**
 * User Registration Endpoint
 * POST /api/auth/register
 */

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

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

    // Create user object
    const user = {
      id: userId,
      email: emailLower,
      passwordHash,
      role: 'user', // Default role
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
      emailVerified: true, // Auto-verify for now (no email service)
      verificationToken: null
    };

    // Store user in Vercel KV
    await kv.set(`user:${userId}`, user);
    await kv.set(`user:email:${emailLower}`, userId);

    // If we had email service, we would:
    // await kv.set(`user:verification:${verificationToken}`, userId, { ex: 86400 });
    // await sendVerificationEmail(email, verificationToken);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. You can now log in.',
      userId,
      user: {
        id: userId,
        email: emailLower,
        firstName,
        lastName
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
