/**
 * POST /api/track
 *
 * Lightweight, KV-backed analytics ingest. Each request increments a
 * handful of daily counters and (for sessions) a daily set. Returns
 * 204 No Content as fast as possible — never blocks the page.
 *
 * Event shapes:
 *   { event: 'pageview',       path, sessionId, referrer, userAgent }
 *   { event: 'add_to_cart',    productId, value }
 *   { event: 'checkout_start', value }
 *
 * Counter keys (all TTL ~95 days):
 *   analytics:counter:{event}:{YYYY-MM-DD}
 *   analytics:path:{path}:{YYYY-MM-DD}
 *   analytics:product:{id}:adds:{YYYY-MM-DD}
 *   analytics:product:{id}:adds:total
 *   analytics:device:{mobile|desktop}:{YYYY-MM-DD}
 *   analytics:referrer:{host}:{YYYY-MM-DD}
 *   analytics:sessions:{YYYY-MM-DD}   (Set)
 *   analytics:recent                  (List, capped at 100)
 */

import { kv } from '@vercel/kv';

const TTL_SECONDS = 95 * 24 * 60 * 60;
const VALID_EVENTS = new Set(['pageview', 'add_to_cart', 'checkout_start']);

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function isMobile(ua) {
  if (!ua || typeof ua !== 'string') return false;
  return /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function refHost(ref) {
  if (!ref || typeof ref !== 'string') return '';
  try {
    const u = new URL(ref);
    if (u.hostname === '' || u.hostname.endsWith('polostew.com')) return '';
    return u.hostname;
  } catch (e) {
    return '';
  }
}

function safePath(p) {
  if (!p || typeof p !== 'string') return '/';
  // strip query, cap length, remove trailing slash (except root)
  let q = p.split('?')[0];
  if (q.length > 120) q = q.slice(0, 120);
  if (q.length > 1 && q.endsWith('/')) q = q.slice(0, -1);
  return q || '/';
}

async function safeIncr(key) {
  try {
    await kv.incr(key);
    await kv.expire(key, TTL_SECONDS);
  } catch (e) { /* noop */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read body — sendBeacon may send raw text rather than parsed JSON
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      body = typeof body === 'string' ? JSON.parse(body) : {};
    } catch (e) {
      body = {};
    }
  }

  const event = String(body.event || '');
  if (!VALID_EVENTS.has(event)) {
    return res.status(204).end();
  }

  const day = todayUTC();
  const path = safePath(body.path);
  const sessionId = body.sessionId ? String(body.sessionId).slice(0, 80) : '';
  const ua = body.userAgent ? String(body.userAgent).slice(0, 500) : '';
  const ref = body.referrer ? String(body.referrer).slice(0, 500) : '';
  const productId = body.productId ? String(body.productId).slice(0, 80) : '';
  const value = typeof body.value === 'number' ? body.value : 0;

  // Fire-and-forget: respond first, then write
  res.status(204).end();

  try {
    const tasks = [];

    // 1. Event counter
    tasks.push(safeIncr(`analytics:counter:${event}:${day}`));

    // 2. Device split
    tasks.push(safeIncr(`analytics:device:${isMobile(ua) ? 'mobile' : 'desktop'}:${day}`));

    // 3. Per-event extras
    if (event === 'pageview') {
      tasks.push(safeIncr(`analytics:path:${path}:${day}`));
      const host = refHost(ref);
      if (host) tasks.push(safeIncr(`analytics:referrer:${host}:${day}`));
    } else if (event === 'add_to_cart' && productId) {
      tasks.push(safeIncr(`analytics:product:${productId}:adds:${day}`));
      tasks.push(safeIncr(`analytics:product:${productId}:adds:total`));
    }

    // 4. Unique session set
    if (sessionId) {
      tasks.push(
        kv.sadd(`analytics:sessions:${day}`, sessionId)
          .then(() => kv.expire(`analytics:sessions:${day}`, TTL_SECONDS))
          .catch(() => {})
      );
    }

    // 5. Recent activity list (cap at 100)
    const eventRecord = {
      event,
      path,
      productId,
      value,
      device: isMobile(ua) ? 'mobile' : 'desktop',
      ts: Date.now(),
    };
    tasks.push(
      kv.lpush('analytics:recent', JSON.stringify(eventRecord))
        .then(() => kv.ltrim('analytics:recent', 0, 99))
        .catch(() => {})
    );

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error('[track] ingest error', err);
  }
}
