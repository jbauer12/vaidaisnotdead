// facebook-events.js
//
// Facebook blocks automated scraping, so event details must be filled in manually.
// Copy the info from the Facebook event page and paste it below.
//
// Run with: node facebook-events.js
//
// This script is a template — duplicate it for future Facebook events.

import { createHmac } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const ADMIN_API_KEY = '6a04d59d57036b043cc8b2b4:df32e42452cb18b04b1d52da2b6de0af0ce3ec693940087392d168a70269d89b';
const GHOST_URL     = 'https://vaidaisnotdead.de';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  EVENTS — fill in from the Facebook event page                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

const EVENTS = [

  // ── https://www.facebook.com/events/776787775046871/ ──────────────────
  // Info read from the event poster (event-detail-01.jpg)
  {
    title:    'STARTS × DEFIBRÜLLATOR × POGO GADGETTO',
    slug:     'starts-defibruellator-pogo-gadgetto-2025',
    date:     '2025-10-18',                              // 18.10.2025 (past)
    strip:    '18. Oktober 2025 | After-Show: Techno × PSY im Keller | V.I.M.D. DJ Crew',
    image:    './event-detail-01.jpg',
    featured: false,
    facebook: 'https://www.facebook.com/events/776787775046871/',
    content: `
      <p>
        Vaida is not dead e.V. presents: eine Nacht mit drei Acts aus dem Bereich
        Punk, Alternative und Underground.
      </p>

      <h2>Line-up</h2>
      <ul>
        <li><strong>STARTS</strong></li>
        <li><strong>DEFIBRÜLLATOR</strong></li>
        <li><strong>POGO GADGETTO</strong></li>
      </ul>

      <h2>After-Show</h2>
      <p>Techno × PSY im Keller — V.I.M.D. DJ Crew</p>

      <p>
        Mehr Infos auf der
        <a href="https://www.facebook.com/events/776787775046871/" target="_blank" rel="noopener">Facebook-Veranstaltungsseite</a>.
      </p>
    `,
  },

  // ── https://www.facebook.com/events/1663914447906226 ──────────────────
  {
    title:    "Netti’s Birthday Bash",
    slug:     "nettis-birthday-bash",
    date:     "2026-02-07",
    strip:    "7. Februar 2026 · Viechtach | AK 15 € | Einlass 18:30 Uhr",
    image:    "./netti.png",
    featured: false,
    facebook: "https://www.facebook.com/events/1663914447906226",
    content: `
      <p>
        Wir feiern Nettis Geburtstag – mit Live-Musik, Aftershow im Keller und allem,
        was dazugehört. Kommt vorbei!
      </p>

      <h2>Wann &amp; Wo</h2>
      <p>
        <strong>Samstag, 7. Februar 2026</strong><br>
        Einlass: 18:30 Uhr · Beginn: ca. 20:00 Uhr<br>
        KulturCafé Hinkofer, Friedhofstr. 3, 94234 Viechtach<br>
        Eintritt: 15 €
      </p>

      <h2>Line-up</h2>
      <ul>
        <li><strong>No Future</strong></li>
        <li><strong>Fluchtversuch</strong></li>
        <li><strong>DogHag</strong></li>
      </ul>

      <h2>After-Show im Keller</h2>
      <p>18+ · Psy- / Tekno-Beats von der V.I.N.D. Crew + Guests</p>
      <ul>
        <li>22:00 – 00:00 · DINSKY</li>
        <li>00:00 – 02:00 · EXCULCO</li>
        <li>02:00 – 04:00 · WISSMANONED</li>
        <li>04:00 – Ende · NEIMA</li>
      </ul>

      <p>No Idiots – No Nazis – No Sexists – No AfD</p>

      <p>
        <a href="https://www.facebook.com/events/1663914447906226" target="_blank" rel="noopener">Facebook-Veranstaltungsseite</a>
      </p>
    `,
  },

];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ENGINE — no need to edit below                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

function ghostJwt() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const n = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ exp: n + 300, iat: n, aud: '/admin/' })).toString('base64url');
  const s = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

function mime(path) {
  const ext = path.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] ?? 'image/jpeg';
}

async function req(method, path, body) {
  const res  = await fetch(`${GHOST_URL}/ghost/api/admin${path}`, {
    method,
    headers: { Authorization: `Ghost ${ghostJwt()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? `${method} ${path} → ${res.status}`);
  return json;
}

async function uploadImage(filePath) {
  if (!filePath || !existsSync(filePath)) {
    if (filePath) console.warn(`  ⚠  image not found: ${filePath}`);
    return null;
  }
  const form = new FormData();
  form.append('file', new Blob([readFileSync(filePath)], { type: mime(filePath) }), filePath.split('/').pop());
  form.append('purpose', 'image');
  const res  = await fetch(`${GHOST_URL}/ghost/api/admin/images/upload/`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${ghostJwt()}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'image upload failed');
  return json.images[0].url;
}

async function findPost(slug) {
  const data = await req('GET', `/posts/?filter=slug:${slug}&fields=id,updated_at`);
  return data.posts?.[0] ?? null;
}

async function syncEvent(event) {
  if (event.date === 'YYYY-MM-DD') {
    throw new Error('date not filled in — edit the TODO fields first');
  }

  const imageUrl = await uploadImage(event.image);

  const payload = {
    title:          event.title,
    slug:           event.slug,
    status:         'published',
    featured:       event.featured ?? false,
    published_at:   new Date(event.date).toISOString(),
    custom_excerpt: event.strip,
    tags:           [{ name: 'Event', slug: 'event' }],
    html:           event.content,
    ...(imageUrl ? { feature_image: imageUrl } : {}),
  };

  const existing = await findPost(payload.slug);
  if (existing) {
    await req('PUT', `/posts/${existing.id}/?source=html`, {
      posts: [{ ...payload, updated_at: existing.updated_at }],
    });
    return 'updated';
  }
  await req('POST', `/posts/?source=html`, { posts: [payload] });
  return 'created';
}

async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label} [${result}]`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
  }
}

async function main() {
  console.log('\n── Importing Facebook events ───────────────────────────');
  for (const event of EVENTS) {
    await run(event.title, () => syncEvent(event));
  }
  console.log('\nDone.\n');
}

main().catch(console.error);
