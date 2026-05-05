/**
 * POST /api/admin/journal/save
 *
 * Body: { post: { id?, title, slug?, body, excerpt?, coverImage?, status } }
 *   - id: optional. If present, updates that post. Otherwise creates new.
 *   - status: 'draft' | 'published'
 *   - slug: optional; auto-generated from title if missing
 *
 * Persists the full posts array at KV key `journal:posts`. Public reads
 * (/api/journal) filter to status==='published'.
 *
 * Auth: open for now to match the rest of admin (admin UI itself has no
 * login gate today — see project_api_auth_needed). Tighten before launch.
 */

import { kv } from '@vercel/kv';

const KV_KEY = 'journal:posts';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { post } = req.body || {};
  if (!post || typeof post !== 'object') {
    return res.status(400).json({ error: 'Body must include { post: {...} }' });
  }
  if (!post.title || typeof post.title !== 'string') {
    return res.status(400).json({ error: 'post.title is required' });
  }

  const status = post.status === 'published' ? 'published' : 'draft';

  try {
    const stored = (await kv.get(KV_KEY)) || { posts: [] };
    const posts = Array.isArray(stored.posts) ? stored.posts.slice() : [];

    const now = new Date().toISOString();
    let target;
    if (post.id) {
      target = posts.find((p) => p.id === post.id);
    }

    if (target) {
      target.title = post.title;
      target.slug = post.slug ? slugify(post.slug) : (target.slug || slugify(post.title));
      target.body = post.body || '';
      target.excerpt = post.excerpt || '';
      target.coverImage = post.coverImage || '';
      target.updatedAt = now;
      const wasPublished = target.status === 'published';
      target.status = status;
      if (status === 'published' && !wasPublished) {
        target.publishedAt = now;
      }
    } else {
      const id = 'post-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      let slug = post.slug ? slugify(post.slug) : slugify(post.title);
      if (!slug) slug = id;
      // ensure slug uniqueness
      let candidate = slug;
      let n = 2;
      while (posts.some((p) => p.slug === candidate)) {
        candidate = slug + '-' + n++;
      }
      target = {
        id,
        slug: candidate,
        title: post.title,
        body: post.body || '',
        excerpt: post.excerpt || '',
        coverImage: post.coverImage || '',
        status,
        createdAt: now,
        updatedAt: now,
        publishedAt: status === 'published' ? now : null,
      };
      posts.unshift(target);
    }

    await kv.set(KV_KEY, { posts, updatedAt: now });
    return res.status(200).json({ success: true, post: target });
  } catch (error) {
    console.error('Journal save error:', error);
    return res.status(500).json({ error: error.message });
  }
}
