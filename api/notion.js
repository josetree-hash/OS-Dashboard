export default async function handler(req, res) {
  // Allow all origins (your dashboard needs this)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Notion-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the Notion path from query, e.g. /api/notion?path=databases/xxx/query
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const notionUrl = `https://api.notion.com/v1/${path}`;
  const token = req.headers['authorization'];
  const notionVersion = req.headers['notion-version'] || '2022-06-28';

  try {
    const response = await fetch(notionUrl, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
