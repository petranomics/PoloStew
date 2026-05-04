/**
 * POST /api/shopify/checkout
 * Body: { items: [{ variantId, quantity }] }
 * Returns: { checkoutUrl }
 *
 * Uses the Storefront API tokenless: the merchant's app has the
 * `unauthenticated_write_checkouts` scope configured, which makes the
 * cartCreate mutation publicly callable. The customer is then redirected
 * to Shopify's hosted checkout — Shopify handles payment, fulfillment,
 * and writes the order back to its admin natively.
 */

const STOREFRONT_API_VERSION = '2024-10';

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shop = process.env.SHOPIFY_STORE_URL;
  if (!shop) {
    return res.status(500).json({ error: 'SHOPIFY_STORE_URL not configured' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Body must be { items: [...] } with at least one item' });
  }

  const lines = items
    .filter((i) => i && i.variantId)
    .map((i) => ({
      merchandiseId: `gid://shopify/ProductVariant/${i.variantId}`,
      quantity: i.quantity || 1,
    }));

  if (lines.length === 0) {
    return res.status(400).json({
      error: 'No items have a Shopify variant ID. Re-sync products from Shopify and re-add to cart.',
    });
  }

  try {
    const apiUrl = `https://${shop}/api/${STOREFRONT_API_VERSION}/graphql.json`;
    const sfRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: CART_CREATE_MUTATION,
        variables: { input: { lines } },
      }),
    });

    if (!sfRes.ok) {
      const text = await sfRes.text();
      console.error('Storefront API error:', sfRes.status, text);
      return res.status(502).json({ error: `Storefront API error (${sfRes.status})` });
    }

    const data = await sfRes.json();

    if (data.errors && data.errors.length) {
      console.error('Storefront GraphQL errors:', data.errors);
      return res.status(502).json({ error: data.errors[0].message });
    }

    const result = data.data && data.data.cartCreate;
    if (result.userErrors && result.userErrors.length) {
      console.error('cartCreate userErrors:', result.userErrors);
      return res.status(400).json({ error: result.userErrors[0].message });
    }

    const checkoutUrl = result.cart && result.cart.checkoutUrl;
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'No checkoutUrl returned from Shopify' });
    }

    return res.status(200).json({ checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
