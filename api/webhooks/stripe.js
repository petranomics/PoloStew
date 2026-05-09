/**
 * POST /api/webhooks/stripe
 * Stripe sends events here. We listen for `checkout.session.completed`
 * and (optionally) record the sale. Inventory tracking happens client-side
 * in localStorage today, so this webhook mostly logs and emails.
 *
 * SETUP:
 * 1. In Stripe Dashboard → Developers → Webhooks → Add endpoint
 * 2. URL: https://polostew.com/api/webhooks/stripe
 * 3. Events: checkout.session.completed, checkout.session.expired
 * 4. Copy the signing secret → set STRIPE_WEBHOOK_SECRET in Vercel
 */

import Stripe from 'stripe';
import { kv } from '@vercel/kv';

const ANALYTICS_TTL = 95 * 24 * 60 * 60;
function todayUTC() { return new Date().toISOString().slice(0, 10); }
async function safeIncrBy(key, amount) {
  try {
    await kv.incrby(key, amount);
    await kv.expire(key, ANALYTICS_TTL);
  } catch (e) { /* noop */ }
}
async function safeIncr(key) {
  try { await kv.incr(key); await kv.expire(key, ANALYTICS_TTL); } catch (e) {}
}

// Disable Vercel's default body parser so we get the raw body for signature verification
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('Stripe webhook env vars missing');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const stripe = new Stripe(secretKey, {
    maxNetworkRetries: 0,
    timeout: 8000,
  });

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Pull line items with metadata to figure out which PoloStew products were sold
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        expand: ['data.price.product'],
      });

      const soldItems = lineItems.data.map((li) => ({
        polostewId: li.price?.product?.metadata?.polostewId || null,
        name: li.description,
        quantity: li.quantity,
        amountTotal: li.amount_total,
      }));

      console.log('[stripe webhook] Order completed', {
        sessionId: session.id,
        email: session.customer_details?.email,
        amountTotal: session.amount_total,
        items: soldItems,
        shippingAddress: session.shipping_details?.address,
      });

      // Analytics: write daily revenue + orders + per-product purchase counts
      try {
        const day = todayUTC();
        const amount = Number(session.amount_total) || 0;
        await safeIncrBy(`analytics:revenue:${day}`, amount);
        await safeIncr(`analytics:orders:${day}`);
        await safeIncr(`analytics:counter:purchase:${day}`);
        for (const item of soldItems) {
          if (item.polostewId) {
            await safeIncr(`analytics:product:${item.polostewId}:purchases:total`);
            await safeIncr(`analytics:product:${item.polostewId}:purchases:${day}`);
          }
        }
      } catch (analyticsErr) {
        console.error('[stripe webhook] analytics write failed', analyticsErr.message);
      }

      // TODO: when we move products to a database, mark each soldItems[].polostewId as stock=0 here
      // For now, products are in localStorage on the admin browser, so the merchant manually
      // marks items sold by viewing the Stripe dashboard or the order email.
    } else if (event.type === 'checkout.session.expired') {
      console.log('[stripe webhook] Session expired', event.data.object.id);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
