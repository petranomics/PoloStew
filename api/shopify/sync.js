import { getShopifyToken } from '../../lib/shopifyAuth.mjs';
import { requireAdmin } from '../../lib/admin-auth.mjs';

// Maps Shopify product types to PoloStew categories
const CATEGORY_MAP = {
  't-shirt': 'Vintage Tees & Graphic Shirts',
  'tee': 'Vintage Tees & Graphic Shirts',
  'tees': 'Vintage Tees & Graphic Shirts',
  'shirt': 'Shirts & Button-Ups',
  'jersey': 'Jerseys (Sports & Soccer)',
  'jacket': 'Jackets & Outerwear',
  'outerwear': 'Jackets & Outerwear',
  'coat': 'Jackets & Outerwear',
  'hoodie': 'Sweatshirts & Hoodies',
  'sweatshirt': 'Sweatshirts & Hoodies',
  'sweater': 'Sweatshirts & Hoodies',
  'bundle': 'Bundles & Lots',
  'lot': 'Bundles & Lots',
};

function mapCategory(shopifyType) {
  if (!shopifyType) return '';
  const lower = shopifyType.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  for (const key in CATEGORY_MAP) {
    if (lower.includes(key)) return CATEGORY_MAP[key];
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  const shopUrl = process.env.SHOPIFY_STORE_URL;
  if (!shopUrl) {
    return res.status(500).json({ error: 'SHOPIFY_STORE_URL not configured' });
  }

  try {
    const accessToken = await getShopifyToken(shopUrl);
    if (!accessToken) {
      return res.status(412).json({
        error: 'Shopify not connected. Click "Connect Shopify" in admin to install the app on your store.',
      });
    }
    const apiUrl = `https://${shopUrl}/admin/api/2024-01/products.json?limit=250`;
    const shopifyRes = await fetch(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!shopifyRes.ok) {
      const text = await shopifyRes.text();
      console.error('Shopify API error:', shopifyRes.status, text);
      return res.status(shopifyRes.status).json({
        error: `Shopify API error (${shopifyRes.status})`,
      });
    }

    const data = await shopifyRes.json();
    const shopifyProducts = data.products || [];

    const mapped = shopifyProducts.map((p) => {
      const variant = (p.variants && p.variants[0]) || {};
      const images = (p.images || []).map((img) => img.src);
      // status: 'active' | 'draft' | 'archived'
      // published_at: ISO string when published to Online Store, null if not
      const isActive = p.status === 'active';
      const isPublished = !!p.published_at;
      const isCheckoutReady = isActive && isPublished;
      return {
        shopifyId: String(p.id),
        // Shopify checkout needs the variant ID, not the product ID
        variantId: variant.id ? String(variant.id) : '',
        name: p.title,
        brand: p.vendor || '',
        category: mapCategory(p.product_type),
        price: parseFloat(variant.price || 0),
        stock: typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : 1,
        image: images[0] || '',
        images: images,
        size: variant.title && variant.title !== 'Default Title' ? variant.title : '',
        description: (p.body_html || '').replace(/<[^>]*>/g, '').trim(),
        // Publication status — used by admin UI to flag products that won't checkout
        shopifyStatus: p.status || 'unknown',
        publishedAt: p.published_at || null,
        isCheckoutReady,
        // Vintage-specific fields stay empty for user to fill
        color: '',
        condition: '',
        era: '',
        measurements: {},
        features: [],
      };
    });

    const warnings = {
      draft: mapped.filter((p) => p.shopifyStatus === 'draft').length,
      archived: mapped.filter((p) => p.shopifyStatus === 'archived').length,
      unpublished: mapped.filter((p) => p.shopifyStatus === 'active' && !p.publishedAt).length,
      notCheckoutReady: mapped.filter((p) => !p.isCheckoutReady).length,
    };

    return res.status(200).json({
      products: mapped,
      count: mapped.length,
      warnings,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Shopify sync error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
