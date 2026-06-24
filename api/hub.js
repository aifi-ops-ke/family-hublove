// api/hub.js — persists all hub data inside this very GitHub repo
// (data/store.json), using the GitHub Contents API as the database.
// No external service, no dashboard setup, no tokens to copy.

const GITHUB_TOKEN = process.env.GH_STORE_TOKEN;
const REPO = 'aifi-ops-ke/family-hublove';
const FILE_PATH = 'data/store.json';
const API_BASE = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

function defaultHub() {
  return {
    events: [], goals: [], diary: [], wishes: [], story: [], bucket: [],
    notes: [], moods: [], memories: [], settings: {}, presence: {},
    streak: { count: 0, lastDate: null, openedToday: {} },
    chat: [], location: {}, gratitude: []
  };
}

async function ghFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'our-love-hub',
      ...(options.headers || {})
    }
  });
}

async function readStore() {
  const res = await ghFetch(API_BASE);
  if (!res.ok) {
    if (res.status === 404) return { content: {}, sha: null };
    throw new Error(`GitHub read failed: ${res.status}`);
  }
  const json = await res.json();
  const decoded = Buffer.from(json.content, 'base64').toString('utf-8');
  let content;
  try { content = JSON.parse(decoded); } catch (e) { content = {}; }
  return { content, sha: json.sha };
}

async function writeStore(content, sha) {
  const body = {
    message: 'Update hub data',
    content: Buffer.from(JSON.stringify(content)).toString('base64'),
    sha: sha || undefined
  };
  const res = await ghFetch(API_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${errText}`);
  }
  return res.json();
}

// Retry wrapper for write conflicts (sha mismatch when two requests land
// close together) — re-reads latest content and RE-APPLIES the mutator,
// so a losing write never clobbers the other partner's concurrent update.
async function withHub(code, mutator, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const { content: store, sha } = await readStore();
    if (!store[code]) store[code] = defaultHub();
    const hub = store[code];
    const result = mutator(hub);
    try {
      await writeStore(store, sha);
      return result !== undefined ? result : hub;
    } catch (e) {
      if (i === attempts - 1) throw e;
      // conflict: loop back, re-read fresh content, re-apply mutator
      await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
    }
  }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const LOCKED_HUB_CODE = 'hamadajp2026'; // only this exact hub code is ever served — locked for privacy

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, collection } = req.query;
  if (!code) return res.status(400).json({ error: 'Hub code required' });
  if (code !== LOCKED_HUB_CODE) {
    return res.status(403).json({ error: 'This hub is private and locked to its owners.' });
  }

  const allowed = ['events', 'goals', 'diary', 'wishes', 'story', 'bucket', 'notes', 'moods', 'memories', 'chat', 'gratitude'];

  try {
    if (collection === 'settings') {
      if (req.method === 'POST') {
        const updated = await withHub(code, (hub) => {
          hub.settings = { ...hub.settings, ...(req.body || {}) };
          return hub.settings;
        });
        return res.status(200).json({ ok: true, settings: updated });
      }
      if (req.method === 'GET') {
        const { content } = await readStore();
        const hub = content[code] || defaultHub();
        return res.status(200).json({ data: hub.settings || {} });
      }
    }

    if (collection === 'presence') {
      if (req.method === 'POST') {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'name required' });
        await withHub(code, (hub) => { hub.presence[name] = Date.now(); });
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'GET') {
        const { content } = await readStore();
        const hub = content[code] || defaultHub();
        const now = Date.now();
        const online = {};
        for (const [name, ts] of Object.entries(hub.presence || {})) {
          online[name] = (now - ts) < 20000;
        }
        return res.status(200).json({ data: online });
      }
    }

    if (collection === 'location') {
      if (req.method === 'POST') {
        const { name, lat, lng, expiresAt, stop } = req.body || {};
        if (!name) return res.status(400).json({ error: 'name required' });
        await withHub(code, (hub) => {
          if (!hub.location) hub.location = {};
          if (stop) {
            delete hub.location[name];
          } else {
            hub.location[name] = { lat, lng, expiresAt, updatedAt: Date.now() };
          }
        });
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'GET') {
        const { content } = await readStore();
        const hub = content[code] || defaultHub();
        const now = Date.now();
        const active = {};
        for (const [name, loc] of Object.entries(hub.location || {})) {
          if (loc.expiresAt && loc.expiresAt > now) active[name] = loc;
        }
        return res.status(200).json({ data: active });
      }
    }

    if (collection === 'streak') {
      if (req.method === 'POST') {
        const { name } = req.body || {};
        const streak = await withHub(code, (hub) => {
          const today = todayStr();
          const yesterday = yesterdayStr();
          if (!hub.streak.openedToday) hub.streak.openedToday = {};
          if (hub.streak.lastDate !== today) {
            if (hub.streak.lastDate === yesterday) hub.streak.count += 1;
            else hub.streak.count = 1;
            hub.streak.lastDate = today;
            hub.streak.openedToday = {};
          }
          if (name) hub.streak.openedToday[name] = true;
          return hub.streak;
        });
        return res.status(200).json({ ok: true, streak });
      }
      if (req.method === 'GET') {
        const { content } = await readStore();
        const hub = content[code] || defaultHub();
        return res.status(200).json({ data: hub.streak });
      }
    }

    if (req.method === 'GET') {
      const { content } = await readStore();
      const hub = content[code] || defaultHub();
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
      await withHub(code, (hub) => { hub[collection] = body.data; });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Hub API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err.message || err) });
  }
}
