// One-time migration: copies every hub in data/store.json (the old
// GitHub-Contents-API store) into the new Upstash Redis store.
//
// HOW TO RUN THIS (once, after you've set up Redis and before/after you
// deploy the updated api/hub.js):
//   1. Set env vars in your terminal (get these from Upstash / Vercel's
//      Storage tab, same values you put in Vercel's project settings):
//        export UPSTASH_REDIS_REST_URL="https://xxxx.upstash.io"
//        export UPSTASH_REDIS_REST_TOKEN="xxxxx"
//   2. From the project root:
//        npm install
//        node scripts/migrate-to-redis.js
//
// It's safe to run more than once — it just overwrites each hub's fields
// with whatever is currently in data/store.json.

import { Redis } from '@upstash/redis';
import { readFileSync } from 'fs';

const redis = Redis.fromEnv();

const store = JSON.parse(readFileSync(new URL('../data/store.json', import.meta.url)));

const codes = Object.keys(store);
if (codes.length === 0) {
  console.log('No hubs found in data/store.json — nothing to migrate.');
  process.exit(0);
}

for (const code of codes) {
  const hub = store[code];
  const fields = {};
  for (const [key, value] of Object.entries(hub)) {
    fields[key] = JSON.stringify(value);
  }
  await redis.hset(`hub:${code}`, fields);
  console.log(`Migrated hub "${code}" (${Object.keys(fields).length} fields).`);
}

console.log('Done. Your existing events, diary entries, notes, photos, etc. are now in Redis.');
console.log('Note: your anniversary date was already missing from data/store.json before this');
console.log('migration (that was the bug) — just re-enter it once in the app and it will now stick.');
