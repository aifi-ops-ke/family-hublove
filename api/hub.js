if (!global._hubs) global._hubs = {};

function getHub(code) {
  if (!global._hubs[code]) {
    global._hubs[code] = { events: [], goals: [], diary: [], wishes: [], story: [], bucket: [], notes: [], moods: [], memories: [], settings: {}, presence: {}, streak: { count: 0, lastDate: null, openedToday: {} } };
  }
  if (!global._hubs[code].story) global._hubs[code].story = [];
  if (!global._hubs[code].bucket) global._hubs[code].bucket = [];
  if (!global._hubs[code].notes) global._hubs[code].notes = [];
  if (!global._hubs[code].moods) global._hubs[code].moods = [];
  if (!global._hubs[code].memories) global._hubs[code].memories = [];
  if (!global._hubs[code].settings) global._hubs[code].settings = {};
  if (!global._hubs[code].presence) global._hubs[code].presence = {};
  if (!global._hubs[code].streak) global._hubs[code].streak = { count: 0, lastDate: null, openedToday: {} };
  return global._hubs[code];
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, collection } = req.query;
  if (!code) return res.status(400).json({ error: 'Hub code required' });

  const allowed = ['events', 'goals', 'diary', 'wishes', 'story', 'bucket', 'notes', 'moods', 'memories'];

  // SETTINGS — anniversary date, theme preference (object, not array)
  if (collection === 'settings') {
    const hub = getHub(code);
    if (req.method === 'POST') {
      hub.settings = { ...hub.settings, ...(req.body || {}) };
      return res.status(200).json({ ok: true, settings: hub.settings });
    }
    if (req.method === 'GET') {
      return res.status(200).json({ data: hub.settings });
    }
  }

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
        online[name] = (now - ts) < 12000;
      }
      return res.status(200).json({ data: online });
    }
  }

  // STREAK — relationship streak tracker
  if (collection === 'streak') {
    const hub = getHub(code);
    if (req.method === 'POST') {
      const { name } = req.body || {};
      const today = todayStr();
      const yesterday = yesterdayStr();
      if (!hub.streak.openedToday) hub.streak.openedToday = {};
      if (hub.streak.lastDate !== today) {
        // new day - check both partners opened previous day to keep streak
        if (hub.streak.lastDate === yesterday) {
          hub.streak.count += 1;
        } else if (hub.streak.lastDate !== null && hub.streak.lastDate !== today) {
          hub.streak.count = 1; // streak broken, restart
        } else if (hub.streak.lastDate === null) {
          hub.streak.count = 1;
        }
        hub.streak.lastDate = today;
        hub.streak.openedToday = {};
      }
      if (name) hub.streak.openedToday[name] = true;
      return res.status(200).json({ ok: true, streak: hub.streak });
    }
    if (req.method === 'GET') {
      return res.status(200).json({ data: hub.streak });
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
