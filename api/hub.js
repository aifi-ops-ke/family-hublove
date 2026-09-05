// api/hub.js — persists hub data in Upstash Redis (already listed in
// package.json as a dependency).
//
// WHY THIS CHANGED FROM THE GITHUB-CONTENTS VERSION:
// The old version stored every couple's entire data set inside ONE shared
// JSON file in this repo, and wrote it back via a GitHub commit on every
// single change — including lightweight things like a 15-second "I'm
// online" presence ping. That meant:
//   1. Every read had to download and base64-decode that whole shared file
//      (slow, and got slower as more couples used the app) — this is what
//      produced the long/stuck "Loading..." spinner.
//   2. Every write needed the file's current git SHA. If two writes landed
//      close together (e.g. your presence ping and a partner's ping, or a
//      settings save racing a presence ping), one write would get a 409
//      conflict. There was a retry loop, but if it ran out of attempts —
//      easy to do with pings firing every 15s from two phones — the write
//      silently failed. That is almost certainly how the anniversary date
//      got lost: it looked saved in the app, but the commit never landed,
//      and the next refresh pulled the old data straight from GitHub.
//
// Redis fixes both: reads are a single fast lookup (no growing shared
// blob, no decoding), and each collection (events, settings, presence,
// etc.) is its own hash field, so a presence ping and a settings save
// touch different fields and can never conflict with each other.
//
// SETUP REQUIRED: create a free Redis database at https://upstash.com (or
// use Vercel's "Upstash for Redis" / "KV" storage integration from your
// Vercel project's Storage tab — it's the same thing), then set these two
// environment variables in your Vercel project settings:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// (the Vercel integration sets these for you automatically).

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function defaultHub() {
  return {
    events: [], goals: [], diary: [], wishes: [], story: [], bucket: [],
    notes: [], moods: [], memories: [], settings: {}, presence: {},
    streak: { count: 0, lastDate: null, openedToday: {} },
    chat: [], location: {}, gratitude: [], pics: []
  };
}

const FIELDS = Object.keys(defaultHub());

function hkey(code) { return `hub:${code}`; }

async function readHub(code) {
  const raw = await redis.hgetall(hkey(code));
  const hub = defaultHub();
  if (raw) {
    for (const f of FIELDS) {
      if (raw[f] !== undefined && raw[f] !== null) {
        // @upstash/redis auto-parses JSON-looking strings, but guard
        // against already-parsed values or raw strings either way.
        hub[f] = typeof raw[f] === 'string' ? safeParse(raw[f], hub[f]) : raw[f];
      }
    }
  }
  return hub;
}

function safeParse(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

async function writeField(code, field, value) {
  await redis.hset(hkey(code), { [field]: JSON.stringify(value) });
}

// Patch a single field that holds an object (settings, presence, location,
// streak). Only ever touches that one hash field, so it can't be knocked
// over by a concurrent write to a different collection.
async function patchField(code, field, mutator) {
  const current = await readHub(code);
  const updated = mutator(current[field] || {}, current);
  await writeField(code, field, updated);
  return updated;
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

  const { code, collection } = req.query;
  if (!code) return res.status(400).json({ error: 'Hub code required' });
  if (!/^[a-z0-9]{4,40}$/i.test(code)) {
    return res.status(400).json({ error: 'Invalid hub code format.' });
  }

  const allowed = ['events', 'goals', 'diary', 'wishes', 'story', 'bucket', 'notes', 'moods', 'memories', 'chat', 'gratitude', 'pics'];

  try {
    if (collection === 'settings') {
      if (req.method === 'POST') {
        const updated = await patchField(code, 'settings', (settings) => ({ ...settings, ...(req.body || {}) }));
        return res.status(200).json({ ok: true, settings: updated });
      }
      if (req.method === 'GET') {
        const hub = await readHub(code);
        return res.status(200).json({ data: hub.settings || {} });
      }
    }

    if (collection === 'presence') {
      if (req.method === 'POST') {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'name required' });
        await patchField(code, 'presence', (presence) => ({ ...presence, [name]: Date.now() }));
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'GET') {
        const hub = await readHub(code);
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
        await patchField(code, 'location', (location) => {
          const next = { ...location };
          if (stop) delete next[name];
          else next[name] = { lat, lng, expiresAt, updatedAt: Date.now() };
          return next;
        });
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'GET') {
        const hub = await readHub(code);
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
        const streak = await patchField(code, 'streak', (streak) => {
          const s = { openedToday: {}, count: 0, lastDate: null, ...streak };
          const today = todayStr();
          const yesterday = yesterdayStr();
          if (s.lastDate !== today) {
            if (s.lastDate === yesterday) s.count += 1;
            else s.count = 1;
            s.lastDate = today;
            s.openedToday = {};
          }
          if (name) s.openedToday[name] = true;
          return s;
        });
        return res.status(200).json({ ok: true, streak });
      }
      if (req.method === 'GET') {
        const hub = await readHub(code);
        return res.status(200).json({ data: hub.streak });
      }
    }

    if (req.method === 'GET') {
      const hub = await readHub(code);
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
      // Each collection is its own hash field — writing 'events' can never
      // conflict with a concurrent write to 'notes', 'diary', etc.
      await writeField(code, collection, body.data);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Hub API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err.message || err) });
  }
}
