/**
 * Public Journal API
 * GET /api/journal              -> { posts: [...] }   (published only, newest first)
 * GET /api/journal?slug=<slug>  -> { post: {...} }    (only if published)
 *
 * Storage: KV key `journal:posts` holds the full array of posts (drafts +
 * published). Public reads filter to status === 'published'. data/journal.json
 * is the fallback for first-time / fresh deploys.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';

async function loadAll() {
  const stored = await kv.get('journal:posts');
  if (stored && Array.isArray(stored.posts)) return stored.posts;
  const path = join(process.cwd(), 'data', 'journal.json');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  return file.posts || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const all = await loadAll();
    const published = all.filter((p) => p.status === 'published');
    published.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

    const { slug } = req.query;
    if (slug) {
      const post = published.find((p) => p.slug === slug);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      return res.status(200).json({ post });
    }
    return res.status(200).json({ posts: published });
  } catch (error) {
    console.error('Journal API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
