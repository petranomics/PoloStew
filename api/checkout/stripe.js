/**
 * POST /api/checkout/stripe
 * Body: { items: [{ id, name, brand, price, quantity, image }] }
 * Returns: { url } — Stripe Checkout hosted page
 *
 * Uses inline price_data so we don't need to pre-sync products to Stripe.
 * Vintage one-of-a-kind items live in PoloStew admin; Stripe handles payment only.
 * Each line item carries the PoloStew product ID in metadata for the webhook.
 */

import Stripe from 'stripe';

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

  // Resolve where to send the customer back after checkout
  const origin = req.headers.origin || `https://${req.headers.host || 'polostew.com'}`;
  const successUrl = `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/cart`;

  try {
    const stripe = new Stripe(secretKey, {
      maxNetworkRetries: 0,
      timeout: 8000,
    });

    const lineItems = items
      .filter((i) => i && i.price > 0 && i.name)
      .map((i) => {
        const productData = {
          name: i.name,
          metadata: {
            polostewId: String(i.id || ''),
            brand: i.brand || '',
          },
        };
        if (i.image) productData.images = [i.image];
        if (i.brand) productData.description = i.brand + (i.condition ? ' · ' + i.condition : '');

        return {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(parseFloat(i.price) * 100),
            product_data: productData,
          },
          quantity: i.quantity || 1,
        };
      });

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid items in cart' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 800, currency: 'usd' },
            display_name: 'Standard Shipping (3-7 days)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Free Shipping (5-10 days)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 },
            },
          },
        },
      ],
      metadata: {
        source: 'polostew',
        itemCount: String(items.length),
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
