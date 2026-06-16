// setup-pages.js — Create or update static Ghost pages
//
// Run once after a fresh Ghost installation:
//   node setup-pages.js           → production (vaidaisnotdead.de)
//   node setup-pages.js --local   → localhost:2368
//
// Pages are matched by slug. Existing pages are updated, missing ones created.

import 'dotenv/config';
import { createHmac } from 'crypto';

const LOCAL = process.argv.includes('--local');

const ADMIN_API_KEY = LOCAL ? process.env.GHOST_LOCAL_ADMIN_API_KEY : process.env.GHOST_ADMIN_API_KEY;
const GHOST_URL     = LOCAL ? process.env.GHOST_LOCAL_URL : process.env.GHOST_URL;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  PAGES                                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

const PAGES = [
  {
    title:  'Kontakt',
    slug:   'kontakt',
    status: 'published',
  },
  {
    title:  'Galerie',
    slug:   'galerie',
    status: 'published',
  },
  {
    title:  'Events',
    slug:   'events',
    status: 'published',
  },
  {
    title:  'FAQ',
    slug:   'faq',
    status: 'published',
  },
  {
    title:  'Mitglied werden',
    slug:   'mitglied-werden',
    status: 'published',
  },
  {
    title:   'Über Uns',
    slug:    'ueber-uns',
    status:  'published',
    initialHtml: `
<h2>Was ist Vaida?</h2>
<p>Vaida is not dead e.V. ist ein gemeinnütziger Kulturverein aus Viechtach im Bayerischen Wald. Wir organisieren DIY-Konzerte, offene Sessions und Abende rund um Punk, Techno und alternative Kultur – laut, unabhängig und aus der Region.</p>

<h2>Warum ein Verein?</h2>
<p>Weil Kultur einen Rahmen braucht. Der Verein gibt uns die Möglichkeit, Räume zu mieten, Veranstaltungen zu organisieren und langfristig etwas aufzubauen – getragen von Menschen, die das wollen.</p>

<h2>Was bewegt uns?</h2>
<p>Die Überzeugung, dass gute Musik und echte Begegnungen nicht in die Stadt gehören – sondern dorthin, wo die Menschen sind.</p>
    `.trim(),
  },
  {
    title:  'Impressum',
    slug:   'impressum',
    status: 'published',
  },
  {
    title:  'Datenschutzerklärung',
    slug:   'datenschutz',
    status: 'published',
  },
];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ENGINE                                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

function ghostJwt() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ exp: now + 300, iat: now, aud: '/admin/' })).toString('base64url');
  const sig     = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function req(method, path, body) {
  const url  = `${GHOST_URL}/ghost/api/admin${path}`;
  const opts = {
    method,
    headers: { Authorization: `Ghost ${ghostJwt()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res  = await fetch(url, opts);
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? `${method} ${path} → ${res.status}`);
  return json;
}

async function findPage(slug) {
  try {
    const data = await req('GET', `/pages/?filter=slug:${slug}&fields=id,slug,updated_at`);
    return data.pages?.[0] ?? null;
  } catch {
    return null;
  }
}

async function syncPage(page) {
  const { initialHtml, ...pageData } = page;
  const existing = await findPage(page.slug);
  if (existing) {
    await req('PUT', `/pages/${existing.id}/?source=html`, { pages: [{ ...pageData, updated_at: existing.updated_at }] });
    console.log(`  ✓ ${page.slug} [updated]`);
  } else {
    const createData = initialHtml ? { ...pageData, html: initialHtml } : pageData;
    await req('POST', '/pages/?source=html', { pages: [createData] });
    console.log(`  ✓ ${page.slug} [created]`);
  }
}

console.log('── Syncing pages ───────────────────────────────────────');
for (const page of PAGES) {
  try {
    await syncPage(page);
  } catch (err) {
    console.error(`  ✗ ${page.slug}: ${err.message}`);
  }
}
console.log('\nDone.');
