/**
 * GET /api/cron/ebay-sync — fired by Vercel Cron every 12 hours.
 *
 * Pulls active listings from eBay, merges into the live published catalog
 * stored in KV, and marks anything no longer listed on eBay as sold (stock=0).
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` for cron-triggered
 * invocations. Without that header it returns 401 — so manual GET hits won't
 * trigger spurious syncs.
 */

import { kv } from '@vercel/kv';
import { getEbayAppToken, getEbayApiBase } from '../../lib/ebayAuth.mjs';

const CATEGORY_MAP = {
  't-shirt': 'Vintage Tees & Graphic Shirts',
  't-shirts': 'Vintage Tees & Graphic Shirts',
  'tee': 'Vintage Tees & Graphic Shirts',
  'shirt': 'Shirts & Button-Ups',
  'casual button-down shirts': 'Shirts & Button-Ups',
  'jersey': 'Jerseys (Sports & Soccer)',
  'jerseys': 'Jerseys (Sports & Soccer)',
  'fan apparel': 'Jerseys (Sports & Soccer)',
  'jacket': 'Jackets & Outerwear',
  'jackets': 'Jackets & Outerwear',
  'coats': 'Jackets & Outerwear',
  'hoodie': 'Sweatshirts & Hoodies',
  'hoodies': 'Sweatshirts & Hoodies',
  'sweatshirt': 'Sweatshirts & Hoodies',
  'sweater': 'Sweatshirts & Hoodies',
  'mixed lots': 'Bundles & Lots',
};

function mapCategory(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  for (const key in CATEGORY_MAP) {
    if (lower.includes(key)) return CATEGORY_MAP[key];
  }
  return '';
}

function mapCondition(id) {
  const map = {
    1000: 'New / Deadstock',
    1500: 'New / Deadstock',
    2000: 'Excellent (no flaws)',
    2500: 'Very Good (light wear)',
    3000: 'Very Good (light wear)',
    4000: 'Good (visible wear)',
    5000: 'Good (visible wear)',
    6000: 'Fair (notable wear or repairs)',
  };
  return map[id] || 'Good (visible wear)';
}

function getSpecific(specifics, name) {
  const f = (specifics || []).find((s) => s.name && s.name.toLowerCase() === name.toLowerCase());
  if (!f) return '';
  return Array.isArray(f.value) ? f.value[0] : f.value;
}

export default async function handler(req, res) {
  // Vercel cron auth
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sellerUsername = (process.env.EBAY_SELLER_USERNAME || '').trim();
  if (!sellerUsername) {
    return res.status(500).json({ error: 'EBAY_SELLER_USERNAME not configured' });
  }

  try {
    const startedAt = Date.now();
    const token = await getEbayAppToken();
    const base = getEbayApiBase();

    // Fetch all active listings (paginated)
    const limit = 200;
    let offset = 0;
    let allItems = [];
    while (true) {
      const url =
        `${base}/buy/browse/v1/item_summary/search` +
        `?filter=sellers:{${encodeURIComponent(sellerUsername)}}` +
        `&category_ids=11450` + // Clothing, Shoes & Accessories — required since Browse API rejects seller-only filters
        `&limit=${limit}&offset=${offset}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`eBay search ${r.status}: ${text.slice(0, 300)}`);
      }
      const data = await r.json();
      const items = data.itemSummaries || [];
      allItems = allItems.concat(items);
      const total = data.total || 0;
      if (items.length < limit || offset + limit >= total) break;
      offset += limit;
      if (offset >= 1000) break;
    }

    // Fetch details (concurrency 5)
    const detailed = [];
    for (let i = 0; i < allItems.length; i += 5) {
      const batch = allItems.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (item) => {
          try {
            const r = await fetch(`${base}/buy/browse/v1/item/${encodeURIComponent(item.itemId)}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              },
            });
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        }),
      );
      detailed.push(...results.filter(Boolean));
    }

    // Build index of fresh eBay data keyed by ebayItemId
    const freshByEbayId = {};
    detailed.forEach((p) => {
      const images = (p.image ? [p.image.imageUrl] : []).concat(
        (p.additionalImages || []).map((i) => i.imageUrl),
      );
      const specifics = p.localizedAspects || [];
      freshByEbayId[p.itemId] = {
        ebayItemId: p.itemId,
        ebayUrl: p.itemWebUrl,
        name: p.title,
        brand: getSpecific(specifics, 'Brand') || p.brand || '',
        category:
          mapCategory(p.categoryPath) ||
          mapCategory((p.categories && p.categories[0] && p.categories[0].categoryName) || ''),
        price: parseFloat(p.price?.value || 0),
        basePrice: parseFloat(p.price?.value || 0),
        stock: p.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity ?? 1,
        image: images[0] || '',
        images,
        size: getSpecific(specifics, 'Size') || '',
        color: getSpecific(specifics, 'Color') || '',
        condition: mapCondition(p.conditionId),
        team: getSpecific(specifics, 'Team') || '',
        player: getSpecific(specifics, 'Player') || '',
        year: getSpecific(specifics, 'Year') || '',
        description: (p.shortDescription || p.description || '').replace(/<[^>]*>/g, '').trim(),
      };
    });

    // Pull existing published catalog from KV
    const existingPub = await kv.get('published:products');
    const existing = (existingPub && existingPub.products) || [];

    // Merge: keep non-eBay-sourced products as-is, update or mark-sold the eBay ones,
    // and add any brand-new eBay listings.
    const seenEbayIds = {};
    const merged = existing.map((p) => {
      if (!p.ebayItemId) return p; // not an eBay product, leave alone
      seenEbayIds[p.ebayItemId] = true;
      const fresh = freshByEbayId[p.ebayItemId];
      if (fresh) {
        // Item still active on eBay — refresh synced fields, preserve user-edited
        return {
          ...p,
          name: fresh.name,
          price: fresh.price,
          basePrice: fresh.basePrice,
          stock: fresh.stock,
          image: p.image || fresh.image,
          images: p.images && p.images.length > 0 ? p.images : fresh.images,
          ebayUrl: fresh.ebayUrl,
        };
      }
      // Was on eBay, now gone → sold
      return { ...p, stock: 0 };
    });

    // Add brand new eBay listings not yet in the catalog
    let nextId = Math.max(0, ...merged.map((p) => Number(p.id) || 0)) + 1;
    Object.values(freshByEbayId).forEach((f) => {
      if (!seenEbayIds[f.ebayItemId]) {
        merged.push({ ...f, id: String(nextId++) });
      }
    });

    // Persist
    await kv.set('published:products', {
      products: merged,
      publishedAt: new Date().toISOString(),
      lastEbaySync: new Date().toISOString(),
    });

    const stats = {
      activeOnEbay: detailed.length,
      totalInCatalog: merged.length,
      markedSold: existing.filter(
        (p) => p.ebayItemId && p.stock > 0 && !freshByEbayId[p.ebayItemId],
      ).length,
      durationMs: Date.now() - startedAt,
    };

    console.log('[cron ebay-sync]', stats);
    return res.status(200).json({ ok: true, ...stats });
  } catch (error) {
    console.error('[cron ebay-sync] failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
