// watch.js — Watch theme files and re-activate on local Ghost automatically
//
// Usage: node watch.js
// Requires local Ghost running via docker-compose (localhost:2368)

import 'dotenv/config';
import { createHmac } from 'crypto';
import { watch } from 'chokidar';
import { resolve, relative } from 'path';

const GHOST_URL = process.env.GHOST_LOCAL_URL ?? 'http://localhost:2368';
const ADMIN_API_KEY = process.env.GHOST_LOCAL_ADMIN_API_KEY;
const THEME_DIR = resolve('../theme');

if (!ADMIN_API_KEY) {
  console.error('Missing GHOST_LOCAL_ADMIN_API_KEY in .env');
  process.exit(1);
}

function ghostJwt() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: now + 300, iat: now, aud: '/admin/' })).toString('base64url');
  const sig     = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

let debounceTimer = null;

async function reload(path) {
  const rel = relative(THEME_DIR, path);
  process.stdout.write(`  changed: ${rel} → reloading… `);
  try {
    const res = await fetch(`${GHOST_URL}/ghost/api/admin/themes/vaida/activate/`, {
      method: 'PUT',
      headers: { Authorization: `Ghost ${ghostJwt()}` },
    });
    if (res.ok) {
      console.log('✓');
    } else {
      const err = await res.json();
      console.log('✗', err.errors?.[0]?.message ?? res.status);
    }
  } catch (e) {
    console.log('✗', e.message);
  }
}

function schedule(path) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => reload(path), 300);
}

const watcher = watch(THEME_DIR, {
  ignored: /(^|[/\\])\..|(node_modules)|(.map$)|(screenshot)/,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
});

watcher.on('change', schedule).on('add', schedule).on('unlink', schedule);

console.log(`Watching ${THEME_DIR}`);
console.log(`Ghost:   ${GHOST_URL}\n`);
