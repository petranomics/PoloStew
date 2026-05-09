/**
 * /api/admin/content
 *
 * GET  - returns merged content (defaults + stored overrides)
 * POST - saves a content map { content: { 'key.path': 'value', ... } }
 *        Persists to KV at `site:content`. Admin-gated.
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../lib/admin-auth.mjs';
import { DEFAULTS, loadContent } from '../content.js';

const KV_KEY = 'site:content';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    try {
      const content = await loadContent();
      return res.status(200).json({ content, defaults: DEFAULTS });
    } catch (err) {
      console.error('[admin/content] GET error', err);
      return res.status(500).json({ error: 'Failed to load content' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const incoming = body.content && typeof body.content === 'object' ? body.content : null;
      if (!incoming) {
        return res.status(400).json({ error: 'Body must include { content: { ... } }' });
      }

      // Only persist values for known keys, and skip values that match defaults
      const cleaned = {};
      for (const key of Object.keys(DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) {
          const v = typeof incoming[key] === 'string' ? incoming[key] : '';
          if (v !== DEFAULTS[key]) cleaned[key] = v;
        }
      }

      await kv.set(KV_KEY, cleaned);
      const merged = { ...DEFAULTS, ...cleaned };
      return res.status(200).json({ success: true, content: merged });
    } catch (err) {
      console.error('[admin/content] POST error', err);
      return res.status(500).json({ error: 'Failed to save content' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
