/**
 * User Wishlist Endpoint
 * GET/POST/DELETE /api/user/wishlist
 */

import { kv } from '@vercel/kv';
import { parseCookies, verifyAuth } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Parse cookies and verify authentication
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const user = await kv.get(`user:${req.user.id}`);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Ensure wishlist exists
  if (!user.wishlist) {
    user.wishlist = [];
  }

  // GET - Retrieve wishlist
  if (req.method === 'GET') {
    return res.status(200).json({
      wishlist: user.wishlist
    });
  }

  // POST - Add item to wishlist
  if (req.method === 'POST') {
    try {
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      // Check if already in wishlist
      if (user.wishlist.includes(productId)) {
        return res.status(200).json({
          success: true,
          message: 'Item already in wishlist',
          wishlist: user.wishlist
        });
      }

      // Add to wishlist
      user.wishlist.push(productId);
      await kv.set(`user:${req.user.id}`, user);

      return res.status(200).json({
        success: true,
        message: 'Item added to wishlist',
        wishlist: user.wishlist
      });

    } catch (error) {
      console.error('Wishlist POST error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE - Remove item from wishlist
  if (req.method === 'DELETE') {
    try {
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      // Remove from wishlist
      user.wishlist = user.wishlist.filter(id => id !== productId);
      await kv.set(`user:${req.user.id}`, user);

      return res.status(200).json({
        success: true,
        message: 'Item removed from wishlist',
        wishlist: user.wishlist
      });

    } catch (error) {
      console.error('Wishlist DELETE error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
