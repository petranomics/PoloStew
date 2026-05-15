/**
 * GET /api/debug/ebay-env?key=polostew-debug-2026
 * Returns truncated env var info for debugging — never the full secret.
 * DELETE THIS FILE once eBay sync is verified working.
 */
export default function handler(req, res) {
  if (req.query.key !== 'polostew-debug-2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  function preview(s) {
    if (!s) return null;
    return {
      length: s.length,
      first4: s.slice(0, 4),
      last4: s.slice(-4),
      hasLeadingSpace: s !== s.trimStart(),
      hasTrailingSpace: s !== s.trimEnd(),
      hasInvisibleChars: /[^\x20-\x7E]/.test(s),
    };
  }
  return res.status(200).json({
    EBAY_APP_ID: preview(process.env.EBAY_APP_ID),
    EBAY_CERT_ID: preview(process.env.EBAY_CERT_ID),
    EBAY_SELLER_USERNAME: preview(process.env.EBAY_SELLER_USERNAME),
    EBAY_ENV: process.env.EBAY_ENV || null,
  });
}
