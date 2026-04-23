/**
 * Admin Users Management Endpoint
 * GET/PUT/DELETE /api/admin/users
 * Requires admin authentication
 */

import { kv } from '@vercel/kv';
import { parseCookies, verifyAuth, verifyAdmin } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Parse cookies, verify auth, then verify admin
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const adminResult = await verifyAdmin(req, res);
  if (adminResult !== true) return;

  // GET - List all users
  if (req.method === 'GET') {
    try {
      const { page = 1, limit = 50 } = req.query;

      // Get all user keys
      const userKeys = [];
      let cursor = '0';

      do {
        const result = await kv.scan(cursor, {
          match: 'user:*',
          count: 100
        });
        cursor = result[0];
        // Filter to only get user UUID keys, not email keys
        const uuidKeys = result[1].filter(key => {
          const parts = key.split(':');
          return parts.length === 2 && parts[1].match(/^[0-9a-f-]{36}$/i);
        });
        userKeys.push(...uuidKeys);
      } while (cursor !== '0');

      // Get all users
      const users = [];
      for (const key of userKeys) {
        const user = await kv.get(key);
        if (user) {
          // Remove sensitive data
          const { passwordHash, verificationToken, ...safeUser } = user;
          users.push(safeUser);
        }
      }

      // Sort by creation date
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Paginate
      const start = (page - 1) * limit;
      const end = start + parseInt(limit);
      const paginatedUsers = users.slice(start, end);

      return res.status(200).json({
        users: paginatedUsers,
        total: users.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(users.length / limit)
      });

    } catch (error) {
      console.error('Users GET error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT - Update user (e.g., change role)
  if (req.method === 'PUT') {
    try {
      const { userId, role } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await kv.get(`user:${userId}`);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent admin from demoting themselves
      if (userId === req.user.id && role !== 'admin') {
        return res.status(400).json({
          error: 'Cannot change your own role'
        });
      }

      // Update role if provided
      if (role) {
        if (!['user', 'admin'].includes(role)) {
          return res.status(400).json({
            error: 'Invalid role',
            allowed: ['user', 'admin']
          });
        }
        user.role = role;
      }

      await kv.set(`user:${userId}`, user);

      const { passwordHash, verificationToken, ...safeUser } = user;

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: safeUser
      });

    } catch (error) {
      console.error('User PUT error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE - Remove user
  if (req.method === 'DELETE') {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Prevent admin from deleting themselves
      if (userId === req.user.id) {
        return res.status(400).json({
          error: 'Cannot delete your own account'
        });
      }

      const user = await kv.get(`user:${userId}`);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete user and email index
      await kv.del(`user:${userId}`);
      await kv.del(`user:email:${user.email}`);

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      console.error('User DELETE error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
