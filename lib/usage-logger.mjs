// /lib/usage-logger.mjs — Unified API usage logger (ESM drop-in).
//
// Copy this file verbatim into each app that needs usage logging:
//   - PoloStew, exotico-coffee, offtrailed: lib/usage-logger.mjs
//   - armadillo-analytics: src/lib/usage-logger.mjs
//
// Writes to the shared Neon `beacons_usage_log` table.
// Requires env: DATABASE_URL  (Neon pg connection string)
// Requires dep: @neondatabase/serverless
//
// Usage:
//   import { logUsage } from '../../lib/usage-logger.mjs';
//   const startedAt = Date.now();
//   const response = await fetch(...).then(r => r.json());
//   await logUsage({
//     app: 'polostew',
//     endpoint: '/api/ai/describe',
//     model: 'claude-haiku-4-5-20251001',
//     provider: 'anthropic',
//     response,
//     latencyMs: Date.now() - startedAt,
//   });
//
// Errors are swallowed — a logging failure must never break a user request.

import { neon } from '@neondatabase/serverless';

const PRICING = {
  'claude-haiku-4-5':   { input: 1.00,  output: 5.00 },
  'claude-sonnet-4-6':  { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':    { input: 15.00, output: 75.00 },
};
const WEB_SEARCH_PRICE_USD = 0.01;
const CACHE_WRITE_MULT_1H = 2;
const CACHE_READ_MULT = 0.1;

function findRate(model) {
  if (!model) return PRICING['claude-haiku-4-5'];
  const stripped = model.replace(/-\d{8}$/, '');
  if (PRICING[stripped]) return PRICING[stripped];
  if (PRICING[model]) return PRICING[model];
  if (model.includes('haiku'))  return PRICING['claude-haiku-4-5'];
  if (model.includes('opus'))   return PRICING['claude-opus-4-7'];
  if (model.includes('sonnet')) return PRICING['claude-sonnet-4-6'];
  return PRICING['claude-haiku-4-5'];
}

export function computeCost({ model, provider, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, webSearches }) {
  if (provider && provider !== 'anthropic') return 0;
  const r = findRate(model);
  const M = 1_000_000;
  const fresh  = (inputTokens || 0)         * r.input  / M;
  const cw     = (cacheCreationTokens || 0) * r.input  * CACHE_WRITE_MULT_1H / M;
  const cr     = (cacheReadTokens || 0)     * r.input  * CACHE_READ_MULT / M;
  const out    = (outputTokens || 0)        * r.output / M;
  const search = (webSearches || 0)         * WEB_SEARCH_PRICE_USD;
  return Number((fresh + cw + cr + out + search).toFixed(6));
}

function extractUsage(response) {
  // Accepts: Anthropic SDK message, raw fetch JSON, or { usage: {...} } wrapper.
  const u = response?.usage || response || {};
  const cacheCreation =
    u.cache_creation_input_tokens ||
    (u.cache_creation && (u.cache_creation['1h_input_tokens'] || u.cache_creation['5m_input_tokens'])) ||
    0;
  return {
    inputTokens:         u.input_tokens || 0,
    outputTokens:        u.output_tokens || 0,
    cacheCreationTokens: cacheCreation,
    cacheReadTokens:     u.cache_read_input_tokens || 0,
  };
}

/**
 * Insert a usage row into the shared `beacons_usage_log` table.
 * Errors are swallowed — a logging failure never breaks a user request.
 *
 * @param {object}  opts
 * @param {string}  opts.app           App identifier ('beacons', 'polostew', etc.)
 * @param {string} [opts.endpoint]     Route or function name
 * @param {string} [opts.tenant]       Account/user id (for multi-tenant attribution)
 * @param {string} [opts.model]        Model id (e.g. 'claude-haiku-4-5-20251001')
 * @param {string} [opts.provider]     'anthropic' | 'mistral' | 'ollama' (default 'anthropic')
 * @param {*}      [opts.response]     Anthropic SDK message, raw fetch JSON, or { usage }
 * @param {number} [opts.webSearches]  Count of web_search tool calls
 * @param {number} [opts.latencyMs]    End-to-end latency
 * @param {object} [opts.metadata]     Free-form JSON
 * @returns {Promise<number|null>}     Cost in USD, or null on failure
 */
export async function logUsage({
  app,
  endpoint,
  tenant,
  model,
  provider,
  response,
  webSearches,
  latencyMs,
  metadata,
}) {
  if (!app) {
    console.warn('[usage-logger] missing app, skipping log');
    return null;
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[usage-logger] DATABASE_URL not set, skipping log');
    return null;
  }
  try {
    const sql = neon(dbUrl);
    const prov = provider || 'anthropic';
    const usage = extractUsage(response);
    const cost = computeCost({
      model,
      provider: prov,
      inputTokens:         usage.inputTokens,
      outputTokens:        usage.outputTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      cacheReadTokens:     usage.cacheReadTokens,
      webSearches:         webSearches || 0,
    });
    await sql`
      INSERT INTO beacons_usage_log (
        app, endpoint, tenant_id, user_id, provider, model,
        input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
        web_searches, cost_usd, latency_ms, metadata
      )
      VALUES (
        ${app}, ${endpoint || null}, ${tenant || null}, ${tenant || null},
        ${prov}, ${model || null},
        ${usage.inputTokens}, ${usage.outputTokens},
        ${usage.cacheCreationTokens}, ${usage.cacheReadTokens},
        ${webSearches || 0}, ${cost}, ${latencyMs || null},
        ${metadata ? JSON.stringify(metadata) : null}
      )
    `;
    return cost;
  } catch (err) {
    console.warn('[usage-logger] log failed (non-fatal):', err?.message || err);
    return null;
  }
}

export { PRICING, findRate };
