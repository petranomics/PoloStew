export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No API key configured' });
  }

  const { name, brand, category, condition, era } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are a vintage clothing expert writing product descriptions for an online thrift store called PoloStew. Write a short, authentic description (2-3 sentences max) for this item. Be specific about what makes it special. Mention era-specific details. Sound like a knowledgeable thrift store owner, not a corporate copywriter. Keep it casual and real.

Item: ${name}
Brand: ${brand || 'Unknown'}
Category: ${category || 'Clothing'}
Condition: ${condition || 'Good'}
Era: ${era || 'Vintage'}

Write ONLY the description text, nothing else. No quotes, no labels, no formatting.`
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
