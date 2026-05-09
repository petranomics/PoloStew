/**
 * GET /api/content
 *
 * Returns site content (lightweight CMS) merged with hardcoded defaults.
 * Public, no auth required. Used by storefront pages on initial render to
 * swap in merchant-edited copy.
 */

import { kv } from '@vercel/kv';

const KV_KEY = 'site:content';

export const DEFAULTS = {
  'hero.slide1.title': 'Fresh Finds',
  'hero.slide1.subtitle': 'Just dropped. One of a kind.',
  'hero.slide1.cta': 'Explore Collection',
  'hero.slide2.title': 'Vintage Denim',
  'hero.slide2.subtitle': 'Broken in. Not broken.',
  'hero.slide2.cta': 'View Collection',
  'hero.slide3.title': 'Jersey Season',
  'hero.slide3.subtitle': 'Game day, every day.',
  'hero.slide3.cta': 'Shop Now',
  'hero.slide4.title': 'Curated Vintage',
  'hero.slide4.subtitle': 'Worn stories. New chapter.',
  'hero.slide4.cta': 'Discover More',
  'brandStory.title': 'The Hunt Is the Point',
  'brandStory.body': "We spend our weekends in warehouse sales, thrift shops, and flea markets so you can spend yours looking good. Every piece on PoloStew was pulled from the wild -- worn in, broken in, one of a kind. No fast fashion, no mass production. Just real clothes with real history. We're here for the hunt, the find, and the feeling of wearing something nobody else has. Sustainability isn't our marketing angle -- it's just what happens when you buy things that already exist.",
  'journalSection.title': 'From the Journal',
  'journalSection.linkText': 'Read all stories →',
  'featured.title': 'Curated Vintage',
  'featured.subtitle': 'Hand-picked vintage finds with character and history',
};

export async function loadContent() {
  let stored = null;
  try {
    stored = await kv.get(KV_KEY);
  } catch (e) {
    // KV unavailable — fall back to defaults silently
    stored = null;
  }
  return { ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const content = await loadContent();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.status(200).json({ content });
  } catch (err) {
    console.error('[content] GET error', err);
    return res.status(200).json({ content: DEFAULTS });
  }
}
