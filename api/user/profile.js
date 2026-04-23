/**
 * User Profile Endpoint
 * GET/PUT /api/user/profile
 */

import { kv } from '@vercel/kv';
import { parseCookies, verifyAuth } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Parse cookies and verify authentication
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return; // Auth middleware already sent response

  // GET - Retrieve user profile
  if (req.method === 'GET') {
    try {
      const user = await kv.get(`user:${req.user.id}`);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user data without sensitive fields
      return res.status(200).json({
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        addresses: user.addresses || [],
        paymentMethods: user.paymentMethods || [],
        wishlist: user.wishlist || [],
        orderHistory: user.orderHistory || [],
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      });

    } catch (error) {
      console.error('Profile GET error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT - Update user profile
  if (req.method === 'PUT') {
    try {
      const { firstName, lastName, phone } = req.body;

      const user = await kv.get(`user:${req.user.id}`);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update profile fields
      if (firstName) user.profile.firstName = firstName;
      if (lastName) user.profile.lastName = lastName;
      if (phone !== undefined) user.profile.phone = phone;

      // Save updated user
      await kv.set(`user:${req.user.id}`, user);

      return res.status(200).json({
        success: true,
        profile: user.profile
      });

    } catch (error) {
      console.error('Profile PUT error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}
