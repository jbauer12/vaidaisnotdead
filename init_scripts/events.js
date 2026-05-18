// events.js — Manage events for vaidaisnotdead
//
// Edit the EVENTS array below, then run:
//   node events.js
//
// The script creates new events and updates existing ones (matched by slug).
// Add slugs to DELETE_SLUGS to remove events.
//
// date:     Event start date (YYYY-MM-DD) — this is what shows in the date badge
// strip:    Short meta line, pipe-separated → shown as pills on the events page
//           e.g. "3. Juli 2026 · Viechtach | Einlass 19:00 | Eintritt frei"
// content:  HTML body — full event description, program, details
// image:    Local file path to a poster/image (optional)
// featured: true = highlighted on the homepage

import 'dotenv/config';
import { createHmac } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const LOCAL = process.argv.includes('--local');

const ADMIN_API_KEY = LOCAL ? process.env.GHOST_LOCAL_ADMIN_API_KEY : process.env.GHOST_ADMIN_API_KEY;
const GHOST_URL     = LOCAL ? process.env.GHOST_LOCAL_URL : process.env.GHOST_URL;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  YOUR EVENTS — edit this section                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

const EVENTS = [
  {
    title:    'Bürgerfest Viechtach 2026',
    slug:     'buergerfest-viechtach-2026',
    date:     '2026-07-03',
    strip:    '3.–5. Juli 2026 · Viechtach | Eintritt frei | Bewerbungen für Acts offen',
    featured: true,
    image:    './buergerfest_post_home_site.png',
    content: `
      <p>
        Ob laut, tanzbar, experimentell oder ganz entspannt: willkommen sind Acts mit eigenem
        Stil und Lust auf ein offenes Stadtfest-Wochenende.
      </p>

      <h2>Wann & Wo</h2>
      <p>
        <strong>Freitag, 3. Juli – Sonntag, 5. Juli 2026</strong><br>
        Viechtach, Bayerischer Wald
      </p>

      <h2>Wir suchen Acts</h2>
      <ul>
        <li>Bands, Solo-Acts und Kollektive aus dem Umfeld von Punk, Techno, Folk und allem dazwischen</li>
        <li>DJs für die Abende zwischen den Live-Slots</li>
        <li>Bereitschaft, Teil eines offenen, nicht-kommerziellen Stadtfest-Rahmens zu sein</li>
      </ul>

      <p>
        Bewerbungen und Fragen an
        <a href="mailto:info@vaidaisnotdead.de">info@vaidaisnotdead.de</a>.
      </p>
    `,
  },
];

// Slugs to permanently delete
const DELETE_SLUGS = [
  'konzertabend-mai-2026',  // placeholder event — remove once real events are added
];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ENGINE — no need to edit below this line                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

function ghostJwt() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ exp: now + 300, iat: now, aud: '/admin/' })).toString('base64url');
  const sig     = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function mime(path) {
  const ext = path.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] ?? 'image/jpeg';
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
  const data = await req('GET', `/posts/?filter=slug:${slug}&fields=id,updated_at,slug`);
  return data.posts?.[0] ?? null;
}

async function syncEvent(event) {
  const imageUrl = await uploadImage(event.image);

  const payload = {
    title:          event.title,
    slug:           event.slug ?? event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    status:         'published',
    featured:       event.featured ?? false,
    published_at:   event.date ? new Date(event.date).toISOString() : undefined,
    custom_excerpt: event.strip ?? null,
    tags:           [{ name: 'Event', slug: 'event' }],
    html:           event.content ?? '',
    ...(imageUrl ? { feature_image: imageUrl } : {}),
  };

  const existing = await findPost(payload.slug);

  if (existing) {
    await req('PUT', `/posts/${existing.id}/?source=html`, {
      posts: [{ ...payload, updated_at: existing.updated_at }],
    });
    return 'updated';
  } else {
    await req('POST', `/posts/?source=html`, { posts: [payload] });
    return 'created';
  }
}

async function deleteEvent(slug) {
  const post = await findPost(slug);
  if (!post) return 'not found';
  await req('DELETE', `/posts/${post.id}/`);
  return 'deleted';
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
  console.log('\n── Syncing events ──────────────────────────────────────');
  for (const event of EVENTS) {
    await run(event.title, () => syncEvent(event));
  }

  if (DELETE_SLUGS.length) {
    console.log('\n── Deleting events ─────────────────────────────────────');
    for (const slug of DELETE_SLUGS) {
      await run(slug, () => deleteEvent(slug));
    }
  }

  console.log('\nDone.\n');
}

main().catch(console.error);
