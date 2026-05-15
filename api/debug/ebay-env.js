/**
 * GET /api/debug/ebay-env?key=polostew-debug-2026
 * Returns env preview + actually attempts an eBay token request to see what fails.
 * DELETE THIS FILE once eBay sync is verified working.
 */
export default async function handler(req, res) {
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
      charCodes: { last3: [s.charCodeAt(s.length-3), s.charCodeAt(s.length-2), s.charCodeAt(s.length-1)] },
    };
  }

  const rawAppId = process.env.EBAY_APP_ID || '';
  const rawCertId = process.env.EBAY_CERT_ID || '';
  const appId = rawAppId.trim();
  const certId = rawCertId.trim();

  // Try eBay token call with the trimmed Vercel value
  let tokenResult = { tested: false };
  try {
    const env = (process.env.EBAY_ENV || 'production').trim();
    const tokenUrl =
      env === 'sandbox'
        ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
        : 'https://api.ebay.com/identity/v1/oauth2/token';
    const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });
    const body = await r.text();
    tokenResult = { tested: true, status: r.status, body: body.slice(0, 300) };
  } catch (err) {
    tokenResult = { tested: true, error: err.message };
  }

  // SHA256 of trimmed values — safe to expose, used to compare against expected hash
  // computed locally without ever putting the real secret in source code.
  const crypto = await import('node:crypto');
  function sha(s) {
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  }
  const hashes = {
    appId_trimmed_sha: sha(appId),
    certId_trimmed_sha: sha(certId),
  };

  return res.status(200).json({
    raw: {
      EBAY_APP_ID: preview(rawAppId),
      EBAY_CERT_ID: preview(rawCertId),
    },
    trimmed: {
      EBAY_APP_ID: preview(appId),
      EBAY_CERT_ID: preview(certId),
    },
    EBAY_ENV: process.env.EBAY_ENV || null,
    EBAY_SELLER_USERNAME: preview(process.env.EBAY_SELLER_USERNAME),
    tokenAttempt: tokenResult,
    hashes,
  });
}
