/**
 * POST /api/admin/newsletter/delete
 *
 * Body: { email: string }
 * Removes a subscriber from the newsletter list. Admin-gated.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

const KV_KEY = 'newsletter:subscribers';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email required' });
    }
    const target = email.trim().toLowerCase();
    let list = (await kv.get(KV_KEY)) || [];
    if (!Array.isArray(list)) list = [];
    const next = list.filter((s) => s && s.email !== target);
    const removed = list.length - next.length;
    await kv.set(KV_KEY, next);
    return res.status(200).json({ success: true, removed, remaining: next.length });
  } catch (err) {
    console.error('[admin/newsletter/delete] error', err);
    return res.status(500).json({ error: 'Failed to remove subscriber' });
  }
}
