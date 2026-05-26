/**
 * Public Banners API
 * GET /api/banners -> { banners: [...] }
 *
 * Storage: KV key `banners:list` holds { banners: [...] }. data/banners.json
 * is the fallback for first-time / fresh deploys.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';

const KV_KEY = 'banners:list';

async function loadAll() {
  const stored = await kv.get(KV_KEY);
  if (stored && Array.isArray(stored.banners)) return stored.banners;
  const path = join(process.cwd(), 'data', 'banners.json');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  return file.banners || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const banners = await loadAll();
    return res.status(200).json({ banners });
  } catch (error) {
    console.error('Banners API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
