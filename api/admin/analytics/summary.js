/**
 * GET /api/admin/analytics/summary?range=7|30|90
 *
 * Aggregates the last N days of KV counters into a dashboard payload.
 * Admin-gated. Defaults to 30 days.
 *
 * Returned shape:
 *   {
 *     range: 30,
 *     dates: ['2026-04-09', ... ],
 *     totals: { pageviews, sessions, addToCart, checkoutStart, orders, revenueCents },
 *     funnel: { sessions, addToCart, checkoutStart, purchase, rates: {...} },
 *     timeseries: [{ date, pageviews, sessions, addToCart, checkoutStart, orders, revenueCents }],
 *     topPaths:    [{ path, views }],
 *     topProductsAdds:      [{ productId, count }],
 *     topProductsPurchases: [{ productId, count }],
 *     topReferrers: [{ host, count }],
 *     deviceSplit: { mobile, desktop },
 *     recent: [{ event, path, productId, value, device, ts }]
 *   }
 */

import { kv } from '@vercel/kv';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

function lastNDates(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function getCounts(keys) {
  if (keys.length === 0) return [];
  try {
    const vals = await kv.mget(...keys);
    return vals.map((v) => Number(v) || 0);
  } catch (e) {
    // mget might fail for very long lists; fall back to per-key
    const out = [];
    for (const k of keys) {
      try { out.push(Number(await kv.get(k)) || 0); } catch (_) { out.push(0); }
    }
    return out;
  }
}

async function scanCount(pattern) {
  const out = {};
  try {
    let cursor = '0';
    do {
      const result = await kv.scan(cursor, { match: pattern, count: 200 });
      cursor = result[0];
      const keys = result[1] || [];
      if (keys.length) {
        const vals = await kv.mget(...keys);
        keys.forEach((k, i) => { out[k] = Number(vals[i]) || 0; });
      }
    } while (cursor !== '0');
  } catch (e) { /* return what we have */ }
  return out;
}

function rate(numer, denom) {
  if (!denom) return 0;
  return Math.round((numer / denom) * 10000) / 100; // percent with 2 decimals
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let range = parseInt(req.query.range, 10);
    if (![7, 30, 90].includes(range)) range = 30;

    const dates = lastNDates(range);

    // 1. Build the per-day counter keys
    const pvKeys = dates.map((d) => `analytics:counter:pageview:${d}`);
    const acKeys = dates.map((d) => `analytics:counter:add_to_cart:${d}`);
    const csKeys = dates.map((d) => `analytics:counter:checkout_start:${d}`);
    const ordKeys = dates.map((d) => `analytics:orders:${d}`);
    const revKeys = dates.map((d) => `analytics:revenue:${d}`);
    const mobileKeys = dates.map((d) => `analytics:device:mobile:${d}`);
    const desktopKeys = dates.map((d) => `analytics:device:desktop:${d}`);
    const sessionSetKeys = dates.map((d) => `analytics:sessions:${d}`);

    const [pvVals, acVals, csVals, ordVals, revVals, mobileVals, desktopVals] = await Promise.all([
      getCounts(pvKeys),
      getCounts(acKeys),
      getCounts(csKeys),
      getCounts(ordKeys),
      getCounts(revKeys),
      getCounts(mobileKeys),
      getCounts(desktopKeys),
    ]);

    // 2. Sessions: scard per day (parallel, fail-soft)
    const sessionVals = await Promise.all(sessionSetKeys.map(async (k) => {
      try { return Number(await kv.scard(k)) || 0; } catch (_) { return 0; }
    }));

    // 3. Build timeseries
    const timeseries = dates.map((d, i) => ({
      date: d,
      pageviews: pvVals[i],
      sessions: sessionVals[i],
      addToCart: acVals[i],
      checkoutStart: csVals[i],
      orders: ordVals[i],
      revenueCents: revVals[i],
    }));

    // 4. Totals
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const totals = {
      pageviews: sum(pvVals),
      sessions: sum(sessionVals),
      addToCart: sum(acVals),
      checkoutStart: sum(csVals),
      orders: sum(ordVals),
      revenueCents: sum(revVals),
    };

    const deviceSplit = {
      mobile: sum(mobileVals),
      desktop: sum(desktopVals),
    };

    // 5. Funnel
    const funnel = {
      sessions: totals.sessions,
      addToCart: totals.addToCart,
      checkoutStart: totals.checkoutStart,
      purchase: totals.orders,
      rates: {
        sessionToAdd: rate(totals.addToCart, totals.sessions),
        addToCheckout: rate(totals.checkoutStart, totals.addToCart),
        checkoutToPurchase: rate(totals.orders, totals.checkoutStart),
        sessionToPurchase: rate(totals.orders, totals.sessions),
      },
    };

    // 6. Top paths and referrers across the whole window (scan + sum per key)
    //    We scan per day for accuracy across the range.
    const pathTotals = {};
    const refTotals = {};
    for (const d of dates) {
      const paths = await scanCount(`analytics:path:*:${d}`);
      Object.entries(paths).forEach(([k, v]) => {
        // key: analytics:path:{path}:{date}
        const parts = k.split(':');
        // path may contain colons, but date is last
        const path = parts.slice(2, -1).join(':');
        pathTotals[path] = (pathTotals[path] || 0) + v;
      });
      const refs = await scanCount(`analytics:referrer:*:${d}`);
      Object.entries(refs).forEach(([k, v]) => {
        const parts = k.split(':');
        const host = parts.slice(2, -1).join(':');
        refTotals[host] = (refTotals[host] || 0) + v;
      });
    }
    const topPaths = Object.entries(pathTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));
    const topReferrers = Object.entries(refTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));

    // 7. Top products (use total counters — cheap, all-time)
    const productAdds = await scanCount('analytics:product:*:adds:total');
    const topProductsAdds = Object.entries(productAdds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, count]) => ({ productId: k.split(':')[2], count }));

    const productPurchases = await scanCount('analytics:product:*:purchases:total');
    const topProductsPurchases = Object.entries(productPurchases)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, count]) => ({ productId: k.split(':')[2], count }));

    // 8. Recent activity feed
    let recent = [];
    try {
      const raw = await kv.lrange('analytics:recent', 0, 19);
      recent = (raw || []).map((r) => {
        try { return typeof r === 'string' ? JSON.parse(r) : r; } catch (_) { return null; }
      }).filter(Boolean);
    } catch (e) { /* empty */ }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      range,
      dates,
      totals,
      deviceSplit,
      funnel,
      timeseries,
      topPaths,
      topProductsAdds,
      topProductsPurchases,
      topReferrers,
      recent,
    });
  } catch (err) {
    console.error('[admin/analytics/summary] error', err);
    return res.status(500).json({ error: 'Failed to build analytics summary' });
  }
}
