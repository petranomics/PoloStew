/**
 * GET /api/admin/journal/list
 * Returns all posts (drafts + published) for the admin UI.
 *
 * Auth: open for now to match the rest of admin (admin UI itself has no
 * login gate today). Tighten before launch.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  try {
    const stored = (await kv.get('journal:posts')) || { posts: [] };
    const posts = Array.isArray(stored.posts) ? stored.posts : [];
    posts.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    return res.status(200).json({ posts });
  } catch (error) {
    console.error('Journal list error:', error);
    return res.status(500).json({ error: error.message });
  }
}
