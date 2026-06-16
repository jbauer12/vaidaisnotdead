// deploy-theme.js — Reload the active theme on Ghost after file changes
//
// Run after updating theme files on the server:
//   node deploy-theme.js           → production (vaidaisnotdead.de)
//   node deploy-theme.js --local   → localhost:2368

import 'dotenv/config';
import { createHmac } from 'crypto';

const LOCAL = process.argv.includes('--local');

const ADMIN_API_KEY = LOCAL ? process.env.GHOST_LOCAL_ADMIN_API_KEY : process.env.GHOST_ADMIN_API_KEY;
const GHOST_URL     = LOCAL ? process.env.GHOST_LOCAL_URL : process.env.GHOST_URL;

function ghostJwt() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ exp: now + 300, iat: now, aud: '/admin/' })).toString('base64url');
  const sig     = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const res = await fetch(`${GHOST_URL}/ghost/api/admin/themes/vaida/activate/`, {
  method: 'PUT',
  headers: { Authorization: `Ghost ${ghostJwt()}` },
});

if (res.ok) {
  console.log('✓ Theme reloaded on', GHOST_URL);
} else {
  const err = await res.json();
  console.error('✗ Failed:', err.errors?.[0]?.message ?? res.status);
  process.exit(1);
}
