/**
 * Public Instagram API
 * GET /api/instagram -> { handle, profileUrl, tiles: [{image, link?}] }
 *
 * Source of truth is KV (key `published:instagram`), populated by the admin
 * via /api/admin/instagram/publish. If KV is empty, fall back to
 * data/instagram.json so the storefront has a sane default at first deploy.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';

async function load() {
  const published = await kv.get('published:instagram');
  if (published && Array.isArray(published.tiles)) return published;
  const path = join(process.cwd(), 'data', 'instagram.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const data = await load();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Instagram API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
