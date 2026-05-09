/**
 * POST /api/newsletter/subscribe
 *
 * Body: { email: string, source?: string }
 *
 * Stores subscribers in KV under the key `newsletter:subscribers` as an
 * array of objects. Always returns success — never reveals whether the
 * email is already subscribed (avoids enumeration).
 */

import { kv } from '@vercel/kv';

const KV_KEY = 'newsletter:subscribers';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, source } = req.body || {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const normalized = email.trim().toLowerCase();

    let list = (await kv.get(KV_KEY)) || [];
    if (!Array.isArray(list)) list = [];

    const exists = list.some((s) => s && s.email === normalized);
    if (!exists) {
      list.push({
        email: normalized,
        subscribedAt: new Date().toISOString(),
        source: typeof source === 'string' && source.length < 80 ? source : 'footer',
      });
      await kv.set(KV_KEY, list);
    }

    // Don't reveal duplicate state to the client
    return res.status(200).json({
      success: true,
      message: "You're on the list. Welcome.",
    });
  } catch (err) {
    console.error('[newsletter/subscribe] error', err);
    return res.status(500).json({ error: 'Could not subscribe. Try again later.' });
  }
}
