if (!global._hubs) global._hubs = {};

function getHub(code) {
  if (!global._hubs[code]) {
    global._hubs[code] = { events: [], goals: [], diary: [], wishes: [], story: [], bucket: [], presence: {} };
  }
  if (!global._hubs[code].story) global._hubs[code].story = [];
  if (!global._hubs[code].bucket) global._hubs[code].bucket = [];
  if (!global._hubs[code].presence) global._hubs[code].presence = {};
  return global._hubs[code];
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, collection } = req.query;
  if (!code) return res.status(400).json({ error: 'Hub code required' });

  const allowed = ['events', 'goals', 'diary', 'wishes', 'story', 'bucket'];

  // PRESENCE — heartbeat ping system
  if (collection === 'presence') {
    const hub = getHub(code);
    if (req.method === 'POST') {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name required' });
      hub.presence[name] = Date.now();
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const now = Date.now();
      const online = {};
      for (const [name, ts] of Object.entries(hub.presence)) {
        online[name] = (now - ts) < 12000; // online if pinged in last 12s
      }
      return res.status(200).json({ data: online });
    }
  }

  if (req.method === 'GET') {
    const hub = getHub(code);
    if (collection) {
      if (!allowed.includes(collection)) return res.status(400).json({ error: 'Bad collection' });
      return res.status(200).json({ data: hub[collection] });
    }
    return res.status(200).json(hub);
  }

  if (req.method === 'POST') {
    if (!collection || !allowed.includes(collection)) {
      return res.status(400).json({ error: 'Valid collection required' });
    }
    const body = req.body;
    if (!body || !Array.isArray(body.data)) {
      return res.status(400).json({ error: 'body.data must be an array' });
    }
    getHub(code)[collection] = body.data;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
