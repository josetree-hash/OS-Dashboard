// Vercel serverless proxy for Paperclip API.
// Solves the HTTPS-to-HTTP mixed-content block: dashboard (HTTPS) → this proxy → your VM (HTTP).
// Mirrors the notion.js pattern — generic pass-through, no business logic.

export default async function handler(req, res) {
  // CORS: dashboard is same-origin (Vercel), but explicit headers stay safe.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Path is everything after /api/ on the Paperclip side.
  // Example: dashboard calls /api/paperclip?path=companies/abc/agents
  //          proxy hits http://136.113.209.144:3100/api/companies/abc/agents
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path parameter' });

  // Your VM. Change here if the IP/port ever moves.
  const PAPERCLIP_BASE = 'http://136.113.209.144:3100';
  const url = `${PAPERCLIP_BASE}/api/${path}`;
  const token = req.headers['authorization'];

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...(token && { 'Authorization': token }),
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Most Paperclip endpoints return JSON, but surface raw text on auth errors
    // or unexpected responses so we can diagnose in the dashboard.
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).json({
        _nonJsonResponse: true,
        _contentType: contentType,
        raw: text.slice(0, 2000),
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: 'Paperclip proxy error',
      detail: err.message,
      hint: 'Most likely the VM is unreachable from Vercel. Verify the IP/port and that the VM is up (pm2 status).',
    });
  }
}
