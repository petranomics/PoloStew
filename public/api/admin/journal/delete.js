/**
 * POST /api/admin/journal/delete
 * Body: { id }
 *
 * Auth: open for now to match the rest of admin. Tighten before launch.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const stored = (await kv.get('journal:posts')) || { posts: [] };
    const posts = (stored.posts || []).filter((p) => p.id !== id);
    await kv.set('journal:posts', { posts, updatedAt: new Date().toISOString() });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Journal delete error:', error);
    return res.status(500).json({ error: error.message });
  }
}
