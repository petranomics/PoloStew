/**
 * POST /api/ebay/sync
 * Fetches active eBay listings for the configured seller and returns them
 * mapped to PoloStew's product format.
 *
 * Required env vars:
 *   EBAY_APP_ID, EBAY_CERT_ID — app credentials (developer.ebay.com)
 *   EBAY_SELLER_USERNAME      — the merchant's eBay user ID
 *   EBAY_ENV                  — 'production' (default) or 'sandbox'
 *
 * Uses the Browse API: https://developer.ebay.com/api-docs/buy/browse/overview.html
 * Item summary search supports a sellers filter that returns only that seller's listings.
 */

import { requireAdmin } from '../../lib/admin-auth.mjs';
import { getEbayAppToken, getEbayApiBase } from '../../lib/ebayAuth.mjs';

const CATEGORY_MAP = {
  // eBay leaf category names → PoloStew categories
  't-shirt': 'Vintage Tees & Graphic Shirts',
  't-shirts': 'Vintage Tees & Graphic Shirts',
  'tee': 'Vintage Tees & Graphic Shirts',
  'graphic tee': 'Vintage Tees & Graphic Shirts',
  'shirt': 'Shirts & Button-Ups',
  'button-up': 'Shirts & Button-Ups',
  'button down': 'Shirts & Button-Ups',
  'casual button-down shirts': 'Shirts & Button-Ups',
  'jersey': 'Jerseys (Sports & Soccer)',
  'jerseys': 'Jerseys (Sports & Soccer)',
  'fan apparel': 'Jerseys (Sports & Soccer)',
  'jacket': 'Jackets & Outerwear',
  'jackets': 'Jackets & Outerwear',
  'coats': 'Jackets & Outerwear',
  'outerwear': 'Jackets & Outerwear',
  'hoodie': 'Sweatshirts & Hoodies',
  'hoodies': 'Sweatshirts & Hoodies',
  'sweatshirt': 'Sweatshirts & Hoodies',
  'sweatshirts': 'Sweatshirts & Hoodies',
  'sweater': 'Sweatshirts & Hoodies',
  'sweaters': 'Sweatshirts & Hoodies',
  'bundle': 'Bundles & Lots',
  'lot': 'Bundles & Lots',
  'mixed lots': 'Bundles & Lots',
};

function mapCategory(categoryName) {
  if (!categoryName) return '';
  const lower = categoryName.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  for (const key in CATEGORY_MAP) {
    if (lower.includes(key)) return CATEGORY_MAP[key];
  }
  return '';
}

// eBay's condition IDs → PoloStew condition labels
function mapCondition(conditionId) {
  const map = {
    1000: 'New / Deadstock', // New
    1500: 'New / Deadstock', // New other
    1750: 'New / Deadstock', // New with defects
    2000: 'Excellent (no flaws)', // Manufacturer refurbished
    2500: 'Very Good (light wear)', // Seller refurbished
    3000: 'Very Good (light wear)', // Used
    4000: 'Good (visible wear)', // Very Good
    5000: 'Good (visible wear)', // Good
    6000: 'Fair (notable wear or repairs)', // Acceptable
    7000: 'Fair (notable wear or repairs)', // For parts or not working
  };
  return map[conditionId] || 'Good (visible wear)';
}

// Pull era from title or item specifics — best-effort
function extractEra(title, itemSpecifics) {
  const decade = (itemSpecifics || []).find((s) => /decade|year|era/i.test(s.name));
  if (decade && decade.value) {
    const v = String(decade.value[0] || decade.value).toLowerCase();
    if (v.includes('70')) return '70s';
    if (v.includes('80')) return '80s';
    if (v.includes('90')) return '90s';
    if (v.includes('00') || v.includes('y2k')) return '2000s';
  }
  const t = (title || '').toLowerCase();
  if (/\b(70s|1970)/.test(t)) return '70s';
  if (/\b(80s|1980)/.test(t)) return '80s';
  if (/\b(90s|1990)/.test(t)) return '90s';
  if (/\b(00s|y2k|2000s)/.test(t)) return '2000s';
  return '';
}

function getSpecific(itemSpecifics, name) {
  const found = (itemSpecifics || []).find(
    (s) => s.name && s.name.toLowerCase() === name.toLowerCase(),
  );
  if (!found) return '';
  return Array.isArray(found.value) ? found.value[0] : found.value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  const sellerUsername = process.env.EBAY_SELLER_USERNAME;
  if (!sellerUsername) {
    return res.status(500).json({ error: 'EBAY_SELLER_USERNAME not configured' });
  }

  try {
    const token = await getEbayAppToken();
    const base = getEbayApiBase();

    // Search summary returns up to 200 items per page; paginate if more
    const limit = 200;
    let offset = 0;
    let allItems = [];
    let total = 0;

    while (true) {
      const url =
        `${base}/buy/browse/v1/item_summary/search` +
        `?filter=sellers:{${encodeURIComponent(sellerUsername)}}` +
        `&category_ids=11450` + // Clothing, Shoes & Accessories — required since Browse API rejects seller-only filters
        `&limit=${limit}&offset=${offset}`;
      const summaryRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      });
      if (!summaryRes.ok) {
        const text = await summaryRes.text();
        console.error('eBay search error:', summaryRes.status, text);
        return res.status(summaryRes.status).json({
          error: `eBay API error (${summaryRes.status}): ${text.slice(0, 300)}`,
        });
      }
      const summary = await summaryRes.json();
      total = summary.total || 0;
      const items = summary.itemSummaries || [];
      allItems = allItems.concat(items);
      if (items.length < limit || offset + limit >= total) break;
      offset += limit;
      if (offset >= 1000) break; // safety cap
    }

    // Fetch detailed item info (item specifics, all images) — limited concurrency
    const detailed = [];
    const concurrency = 5;
    for (let i = 0; i < allItems.length; i += concurrency) {
      const batch = allItems.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (item) => {
          try {
            const r = await fetch(
              `${base}/buy/browse/v1/item/${encodeURIComponent(item.itemId)}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                },
              },
            );
            if (!r.ok) return null;
            return await r.json();
          } catch (err) {
            console.warn('Item detail fetch failed:', item.itemId, err.message);
            return null;
          }
        }),
      );
      detailed.push(...results.filter(Boolean));
    }

    const mapped = detailed.map((p) => {
      const images = (p.image ? [p.image.imageUrl] : []).concat(
        (p.additionalImages || []).map((img) => img.imageUrl),
      );
      const specifics = p.localizedAspects || [];
      const size = getSpecific(specifics, 'Size') || getSpecific(specifics, 'Size Type');
      const color = getSpecific(specifics, 'Color');
      const team = getSpecific(specifics, 'Team') || getSpecific(specifics, 'Sports Team');
      const player = getSpecific(specifics, 'Player') || getSpecific(specifics, 'Athlete');
      const year = getSpecific(specifics, 'Year') || getSpecific(specifics, 'Year Manufactured');
      const brand = getSpecific(specifics, 'Brand') || p.brand || '';
      const category =
        mapCategory(p.categoryPath) ||
        mapCategory((p.categories && p.categories[0] && p.categories[0].categoryName) || '');

      const features = [];
      const featureFields = ['Features', 'Theme', 'Style', 'Pattern', 'Material'];
      featureFields.forEach((f) => {
        const v = getSpecific(specifics, f);
        if (v) features.push(`${f}: ${v}`);
      });

      return {
        ebayItemId: p.itemId,
        ebayUrl: p.itemWebUrl,
        name: p.title,
        brand,
        category,
        price: parseFloat(p.price?.value || 0),
        stock: p.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity ?? 1,
        image: images[0] || '',
        images,
        size: size || '',
        color: color || '',
        condition: mapCondition(p.conditionId),
        era: extractEra(p.title, specifics),
        description: (p.shortDescription || p.description || '').replace(/<[^>]*>/g, '').trim(),
        team: team || '',
        player: player || '',
        year: year || '',
        features,
        measurements: {},
      };
    });

    return res.status(200).json({
      products: mapped,
      count: mapped.length,
      total,
      seller: sellerUsername,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('eBay sync error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
