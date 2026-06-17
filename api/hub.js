import { Redis } from '@upstash/redis';

// Vercel's Redis integration auto-injects these env vars once you add
// the "Redis" storage integration from the Storage tab in your project.
let redis = null;
let redisError = null;
try {
  redis = Redis.fromEnv();
} catch (e) {
  redisError = e.message;
}

const DEFAULTS = {
  events: [], goals: [], diary: [], wishes: [], story: [], bucket: [],
  notes: [], moods: [], memories: [], settings: {}, presence: {},
  streak: { count: 0, lastDate: null, openedToday: {} }
};

function key(code, collection) {
  return `hub:${code}:${collection}`;
}

async function getCollection(code, collection) {
  const data = await redis.get(key(code, collection));
  if (data !== null && data !== undefined) return data;
  return DEFAULTS[collection] ?? [];
}

async function setCollection(code, collection, data) {
  await redis.set(key(code, collection), data);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!redis) {
    return res.status(503).json({
      error: 'Database not connected yet',
      detail: 'Go to your Vercel project → Storage tab → Connect a Redis database, then redeploy.',
      raw: redisError
    });
  }

  const { code, collection } = req.query;
  if (!code) return res.status(400).json({ error: 'Hub code required' });

  const allowed = ['events', 'goals', 'diary', 'wishes', 'story', 'bucket', 'notes', 'moods', 'memories'];

  try {
    // SETTINGS — anniversary date, theme (object, not array)
    if (collection === 'settings') {
      if (req.method === 'POST') {
        const current = await getCollection(code, 'settings');
        const updated = { ...current, ...(req.body || {}) };
        await setCollection(code, 'settings', updated);
        return res.status(200).json({ ok: true, settings: updated });
      }
      if (req.method === 'GET') {
        const data = await getCollection(code, 'settings');
        return res.status(200).json({ data });
      }
    }

    // PRESENCE — heartbeat ping
    if (collection === 'presence') {
      if (req.method === 'POST') {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'name required' });
        const presence = await getCollection(code, 'presence');
        presence[name] = Date.now();
        await setCollection(code, 'presence', presence);
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'GET') {
        const presence = await getCollection(code, 'presence');
        const now = Date.now();
        const online = {};
        for (const [name, ts] of Object.entries(presence)) {
          online[name] = (now - ts) < 12000;
        }
        return res.status(200).json({ data: online });
      }
    }

    // STREAK — relationship streak tracker
    if (collection === 'streak') {
      if (req.method === 'POST') {
        const { name } = req.body || {};
        const streak = await getCollection(code, 'streak');
        const today = todayStr();
        const yesterday = yesterdayStr();
        if (!streak.openedToday) streak.openedToday = {};
        if (streak.lastDate !== today) {
          if (streak.lastDate === yesterday) {
            streak.count += 1;
          } else if (streak.lastDate !== null) {
            streak.count = 1;
          } else {
            streak.count = 1;
          }
          streak.lastDate = today;
          streak.openedToday = {};
        }
        if (name) streak.openedToday[name] = true;
        await setCollection(code, 'streak', streak);
        return res.status(200).json({ ok: true, streak });
      }
      if (req.method === 'GET') {
        const streak = await getCollection(code, 'streak');
        return res.status(200).json({ data: streak });
      }
    }

    // STANDARD COLLECTIONS
    if (req.method === 'GET') {
      if (collection) {
        if (!allowed.includes(collection)) return res.status(400).json({ error: 'Bad collection' });
        const data = await getCollection(code, collection);
        return res.status(200).json({ data });
      }
      // full hub fetch
      const result = {};
      for (const c of allowed) {
        result[c] = await getCollection(code, c);
      }
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      if (!collection || !allowed.includes(collection)) {
        return res.status(400).json({ error: 'Valid collection required' });
      }
      const body = req.body;
      if (!body || !Array.isArray(body.data)) {
        return res.status(400).json({ error: 'body.data must be an array' });
      }
      await setCollection(code, collection, body.data);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Hub API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err.message || err) });
  }
}
