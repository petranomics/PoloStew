/**
 * GET /api/admin/newsletter/list
 *
 * Returns the full subscriber list (admin-gated). Sorted newest-first.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

const KV_KEY = 'newsletter:subscribers';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const list = (await kv.get(KV_KEY)) || [];
    const arr = Array.isArray(list) ? list : [];
    arr.sort((a, b) => {
      const ad = a && a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
      const bd = b && b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
      return bd - ad;
    });
    return res.status(200).json({ subscribers: arr, count: arr.length });
  } catch (err) {
    console.error('[admin/newsletter/list] error', err);
    return res.status(500).json({ error: 'Failed to load subscribers' });
  }
}
