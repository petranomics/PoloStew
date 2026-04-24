export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No API key configured' });
  }

  const {
    name,
    brand,
    category,
    condition,
    era,
    color,
    measurements,
    features,
    team,
    player,
    year,
    printType,
    tagType,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  // Build the contextual details block, only including fields that have values
  const detailLines = [];
  detailLines.push(`Item: ${name}`);
  detailLines.push(`Brand: ${brand || 'Unknown'}`);
  detailLines.push(`Category: ${category || 'Clothing'}`);
  detailLines.push(`Condition: ${condition || 'Good'}`);
  detailLines.push(`Era: ${era || 'Vintage'}`);
  if (color) detailLines.push(`Color: ${color}`);

  if (measurements && typeof measurements === 'object') {
    const measurementEntries = Object.entries(measurements).filter(([, v]) => v && String(v).trim().length > 0);
    if (measurementEntries.length > 0) {
      const formatted = measurementEntries.map(([k, v]) => `${k} ${v}`).join(', ');
      detailLines.push(`Measurements: ${formatted}`);
    }
  }

  if (Array.isArray(features) && features.length > 0) {
    detailLines.push(`Features: ${features.join('; ')}`);
  }

  // Jersey-specific details
  const isJersey = category === 'Jerseys (Sports & Soccer)';
  if (isJersey) {
    if (team) detailLines.push(`Team: ${team}`);
    if (player) detailLines.push(`Player: ${player}`);
    if (year) detailLines.push(`Season/Year: ${year}`);
  }

  // Tee-specific details
  const isTee = category === 'Vintage Tees & Graphic Shirts';
  if (isTee) {
    if (printType) detailLines.push(`Print Type: ${printType}`);
    if (tagType) detailLines.push(`Tag Type: ${tagType}`);
  }

  const prompt = `You are a vintage clothing expert writing product descriptions for an online thrift store called PoloStew. Write a short, authentic, casual description (2-3 sentences max) for this item.

Be specific about what makes it special. When relevant, mention era-specific details (single-stitch construction for tees, screen-printed numbers on jerseys, satin construction on Starter jackets, made-in-USA tags, etc.). If it's a jersey, work in the team/player/season naturally. If it's a tee, you can reference the print type or tag style if it adds character. Mention the color and any standout features. Sound like a knowledgeable thrift store owner who actually wears this stuff — not a corporate copywriter. Keep it real, casual, and concise.

${detailLines.join('\n')}

Write ONLY the description text, nothing else. No quotes, no labels, no formatting.`;

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
        max_tokens: 250,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Haiku API error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text?.trim();

    if (!text) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    return res.status(200).json({ description: text });
  } catch (error) {
    console.error('AI describe error:', error.message);
    return res.status(503).json({ error: 'AI service unavailable' });
  }
}
