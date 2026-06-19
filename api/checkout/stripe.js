/**
 * POST /api/checkout/stripe
 * Body: { items: [{ id, quantity }] }  — only `id` and `quantity` are trusted.
 * Returns: { url } — Stripe Checkout hosted page
 *
 * Calls Stripe REST API directly via fetch to avoid SDK runtime issues in Vercel.
 * Vintage one-of-a-kind items live in PoloStew admin; Stripe handles payment only.
 * Each line item carries the PoloStew product ID in metadata for the webhook.
 *
 * SECURITY: price, name, and image are looked up server-side from the published
 * catalog (KV `published:products`). The client-supplied `price` is IGNORED —
 * trusting it would let a buyer pay any amount for any item.
 */

import { loadProducts } from '../../lib/products-store.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in Vercel.' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Body must be { items: [...] } with at least one item' });
  }

  const origin = req.headers.origin || `https://${req.headers.host || 'polostew.com'}`;
  const successUrl = `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/cart`;

  // Stripe accepts application/x-www-form-urlencoded with bracket notation for nested fields
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('shipping_address_collection[allowed_countries][0]', 'US');
  params.append('shipping_address_collection[allowed_countries][1]', 'CA');

  // Standard shipping
  params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '800');
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  params.append('shipping_options[0][shipping_rate_data][display_name]', 'Standard Shipping (3-7 days)');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '3');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '7');

  // Free shipping
  params.append('shipping_options[1][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[1][shipping_rate_data][fixed_amount][amount]', '0');
  params.append('shipping_options[1][shipping_rate_data][fixed_amount][currency]', 'usd');
  params.append('shipping_options[1][shipping_rate_data][display_name]', 'Free Shipping (5-10 days)');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][minimum][value]', '5');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][maximum][value]', '10');

  params.append('metadata[source]', 'polostew');
  params.append('metadata[itemCount]', String(items.length));

  // Look up the authoritative catalog. Everything that affects what the buyer
  // is charged comes from here — never from the request body.
  let catalog;
  try {
    catalog = await loadProducts();
  } catch (err) {
    console.error('Checkout: failed to load catalog:', err.message);
    return res.status(500).json({ error: 'Could not load catalog. Please try again.' });
  }
  const byId = new Map(catalog.map((p) => [String(p.id), p]));

  // Server-authoritative price: sale price only when on sale, valid, and below base.
  const resolvePrice = (p) => {
    const base = Number(p.basePrice != null ? p.basePrice : p.price);
    const sale = Number(p.salePrice);
    if (p.onSale && Number.isFinite(sale) && sale > 0 && sale < base) return sale;
    return base;
  };

  let lineIndex = 0;
  const unavailable = [];
  for (const item of items) {
    const id = item && item.id != null ? String(item.id) : '';
    const product = byId.get(id);

    // Reject rather than silently drop: the buyer must know if something in
    // their cart is gone or sold out, not be quietly charged for the rest.
    if (!product) { unavailable.push({ id, reason: 'not found' }); continue; }
    const stock = Number(product.stock);
    if (!Number.isFinite(stock) || stock <= 0) { unavailable.push({ id, name: product.name, reason: 'sold out' }); continue; }

    const unitPrice = resolvePrice(product);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) { unavailable.push({ id, name: product.name, reason: 'unpriced' }); continue; }

    // Vintage stock is one-of-a-kind; never let a line exceed available stock.
    const requestedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const quantity = Math.min(requestedQty, stock);

    const prefix = `line_items[${lineIndex}]`;
    params.append(`${prefix}[price_data][currency]`, 'usd');
    params.append(`${prefix}[price_data][unit_amount]`, String(Math.round(unitPrice * 100)));
    params.append(`${prefix}[price_data][product_data][name]`, product.name);
    if (product.brand) {
      const desc = product.brand + (product.condition ? ' · ' + product.condition : '');
      params.append(`${prefix}[price_data][product_data][description]`, desc);
    }
    const image = (Array.isArray(product.images) && product.images[0]) || product.image;
    if (image) {
      params.append(`${prefix}[price_data][product_data][images][0]`, image);
    }
    params.append(`${prefix}[price_data][product_data][metadata][polostewId]`, id);
    if (product.brand) params.append(`${prefix}[price_data][product_data][metadata][brand]`, product.brand);
    params.append(`${prefix}[quantity]`, String(quantity));
    lineIndex++;
  }

  if (unavailable.length > 0) {
    return res.status(409).json({
      error: 'Some items are no longer available. Please review your cart.',
      unavailable,
    });
  }

  if (lineIndex === 0) {
    return res.status(400).json({ error: 'No valid items in cart' });
  }

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error('Stripe API error:', stripeRes.status, data);
      return res.status(stripeRes.status).json({
        error: data.error?.message || `Stripe error (${stripeRes.status})`,
      });
    }

    return res.status(200).json({ url: data.url, sessionId: data.id });
  } catch (error) {
    console.error('Checkout fetch error:', error.message, error.cause);
    return res.status(500).json({ error: `Network error: ${error.message}` });
  }
}
