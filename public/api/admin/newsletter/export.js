/**
 * GET /api/admin/newsletter/export
 *
 * Streams subscribers as a CSV download (admin-gated).
 * Filename: polostew-subscribers-YYYY-MM-DD.csv
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

const KV_KEY = 'newsletter:subscribers';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

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

    const today = new Date().toISOString().slice(0, 10);
    const filename = `polostew-subscribers-${today}.csv`;

    const lines = ['email,subscribed_at,source'];
    for (const s of arr) {
      lines.push(
        [csvEscape(s.email), csvEscape(s.subscribedAt), csvEscape(s.source || '')].join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(lines.join('\n'));
  } catch (err) {
    console.error('[admin/newsletter/export] error', err);
    return res.status(500).json({ error: 'Failed to export subscribers' });
  }
}
