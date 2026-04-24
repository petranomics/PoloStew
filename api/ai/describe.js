export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const VPS_URL = process.env.VPS_AGENT_URL || 'http://72.60.120.245:3000';
  const VPS_KEY = process.env.VPS_AGENT_KEY || 'armadillo-agent-2026';

  try {
    const response = await fetch(`${VPS_URL.replace('/agent/analyze', '')}/agent/describe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': VPS_KEY,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err || 'AI service error' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('AI describe proxy error:', error.message);
    return res.status(503).json({ error: 'AI service unavailable' });
  }
}
