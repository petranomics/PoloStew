/**
 * POST /api/ai/measurements
 * Body: { name, brand, category, size, imageUrl? }
 * Returns: { measurements: { "Pit to Pit": "22\"", "Length": "30\"", ... }, source: 'vision' | 'sizechart' }
 *
 * Two modes:
 *  - With imageUrl: Claude Haiku 4.5 vision analyzes the photo + size chart together.
 *    Best accuracy when there's a flat-lay photo against a contrasting background.
 *  - Without imageUrl: pure size-chart estimation from category + size + brand.
 *
 * The model returns measurements in inches with the inch mark, matching the
 * format the manual measurement form uses.
 */

const SYSTEM_PROMPT = `You are a vintage clothing measurement expert. Estimate garment measurements in inches.

You will receive a category, size, and (sometimes) a photo of the item. Return realistic flat-measured measurements that a vintage seller would list.

Rules:
- Always return measurements in inches with the " mark, e.g. "22\\""
- Return ONLY a JSON object with the measurements — no commentary, no markdown
- Use these exact keys depending on category:
  - Tees / Jerseys / Hoodies / Sweatshirts: "Pit to Pit", "Length", "Sleeve"
  - Shirts & Button-Ups: "Pit to Pit", "Length", "Sleeve", "Shoulder"
  - Jackets / Outerwear: "Pit to Pit", "Length", "Sleeve", "Shoulder"
  - Bundles & Lots: return {} empty object
- For vintage items, account for typical "vintage fit" — older garments often run boxier
- If a size is given (e.g. "L", "XL", "32x30"), use it as the primary anchor
- If a photo is provided, use visual cues (proportions, ratio of width to length) to refine the size-chart starting point
- Never guess wildly — if uncertain, return a reasonable size-chart value for the category and size
- Do not include any keys that aren't measurements (no "fit", "notes", "color", etc.)

Return ONLY the JSON object. No prose. No code fences.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No API key configured' });
  }

  const { name, brand, category, size, imageUrl } = req.body || {};
  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }
  if (!size && !name) {
    return res.status(400).json({ error: 'size or name is required' });
  }

  const useVision = typeof imageUrl === 'string' && imageUrl.startsWith('http');
  const userText = `Estimate measurements for this vintage garment:
Category: ${category}
Size: ${size || '(not specified)'}
${name ? `Name: ${name}` : ''}
${brand ? `Brand: ${brand}` : ''}
${useVision ? 'Use the attached photo to refine your size-chart starting point.' : 'No photo — use size-chart estimation only.'}`;

  const userContent = useVision
    ? [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: userText },
      ]
    : userText;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Haiku measurements API error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text?.trim() || '';

    // Strip code fences if the model wrapped its response
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let measurements;
    try {
      measurements = JSON.parse(cleaned);
    } catch (err) {
      console.error('Failed to parse measurements JSON:', cleaned);
      return res.status(500).json({ error: 'AI returned invalid format' });
    }

    if (typeof measurements !== 'object' || Array.isArray(measurements) || measurements === null) {
      return res.status(500).json({ error: 'AI returned non-object measurements' });
    }

    return res.status(200).json({
      measurements,
      source: useVision ? 'vision' : 'sizechart',
    });
  } catch (error) {
    console.error('Measurements AI error:', error.message);
    return res.status(503).json({ error: 'AI service unavailable' });
  }
}
