/**
 * POST /api/admin/journal/draft-with-ai
 * Body: { topic, tone? }
 * Returns: { title, excerpt, body }
 *
 * Calls Haiku 4.5 with a system prompt scoped to vintage/thrift content.
 * Returns a fully-formed draft (markdown body) that the merchant can edit
 * before publishing. Drafts NEVER auto-publish.
 *
 * Auth: open for now to match the rest of admin. Tighten before launch.
 */

import { logUsage } from '../../../lib/usage-logger.mjs';
import { requireAdmin } from '../../../lib/admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { topic, tone } = req.body || {};
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic is required' });
  }

  const prompt = `You are writing a journal post for PoloStew, a curated vintage clothing store. The voice is knowledgeable, casual, and authentic — like a thrift store owner who actually wears the stuff, not corporate copy.

Topic: ${topic}
${tone ? `Tone notes: ${tone}` : ''}

Write a 400-700 word journal post in markdown. Include:
- A short, punchy title (no quotes, no hashtag)
- A 1-2 sentence excerpt that hooks the reader
- The body in markdown — use ## for section headings, occasional bullet lists where natural, and write in clear paragraphs. Avoid generic openers like "In today's world" or "When it comes to". Don't oversell. Specifics over platitudes (mention real brands, eras, construction details, etc. when relevant).

Return ONLY a JSON object with this exact shape, no surrounding prose, no code fences:
{"title": "...", "excerpt": "...", "body": "..."}`;

  const model = 'claude-haiku-4-5-20251001';
  const startedAt = Date.now();
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Haiku API error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text?.trim();
    if (!text) return res.status(500).json({ error: 'No response from AI' });

    // Be tolerant — strip code fences if model added them despite instructions.
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI draft as JSON. Raw:', text);
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    if (!parsed.title || !parsed.body) {
      return res.status(502).json({ error: 'AI response missing title or body' });
    }

    await logUsage({
      app: 'polostew',
      endpoint: '/api/admin/journal/draft-with-ai',
      model,
      provider: 'anthropic',
      response: result,
      latencyMs: Date.now() - startedAt,
      metadata: { topic },
    });

    return res.status(200).json({
      title: parsed.title,
      excerpt: parsed.excerpt || '',
      body: parsed.body,
    });
  } catch (error) {
    console.error('Journal AI draft error:', error.message);
    return res.status(503).json({ error: 'AI service unavailable' });
  }
}
