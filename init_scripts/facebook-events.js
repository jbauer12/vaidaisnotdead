// facebook-events.js
//
// Partially auto-fetches Facebook event metadata (OG tags) using the
// facebookexternalhit UA. Lineup, pricing, and image still need manual input.
//
// Run with:         node facebook-events.js
// Fetch OG data:    node facebook-events.js --fetch-meta <url>
// Dry run (local):  node facebook-events.js --local

import 'dotenv/config';
import { createHmac } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const LOCAL     = process.argv.includes('--local');
const FETCH_META = process.argv.includes('--fetch-meta');

const ADMIN_API_KEY = LOCAL ? process.env.GHOST_LOCAL_ADMIN_API_KEY : process.env.GHOST_ADMIN_API_KEY;
const GHOST_URL     = LOCAL ? process.env.GHOST_LOCAL_URL : process.env.GHOST_URL;

// ── Meta helper ───────────────────────────────────────────────────────────────
// Uses facebookexternalhit UA — the only UA Facebook serves OG tags to.
// Returns { title, date, location, imageUrl, raw } or throws.
async function fetchFacebookMeta(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    },
  });
  const html = await res.text();

  const og = (prop) => {
    const m = html.match(new RegExp(`property="og:${prop}"\\s+content="([^"]+)"`));
    return m ? m[1] : null;
  };

  const title       = og('title');
  const description = og('description'); // e.g. "Veranstaltung in Viechtach … am Freitag, Mai 22 2026"
  const imageUrl    = og('image');

  // Parse "am Freitag, Mai 22 2026" → ISO date
  const dateMatch = description?.match(/(\w+),\s+(\w+)\s+(\d{1,2})\s+(\d{4})/);
  const MONTHS = { Januar:1,Februar:2,März:3,April:4,Mai:5,Juni:6,Juli:7,
                   August:8,September:9,Oktober:10,November:11,Dezember:12,
                   January:1,February:2,March:3,April:4,May:5,June:6,July:7,
                   August:8,September:9,October:10,November:11,December:12 };
  let date = 'YYYY-MM-DD';
  if (dateMatch) {
    const [, , mon, day, year] = dateMatch;
    const m = MONTHS[mon];
    if (m) date = `${year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // Parse location from "Veranstaltung in <location> von …"
  const locMatch = description?.match(/Veranstaltung in (.+?) von /);
  const location = locMatch ? locMatch[1] : null;

  return { title, date, location, imageUrl, description };
}

// --fetch-meta mode: print parsed metadata and exit
if (FETCH_META) {
  const url = process.argv[process.argv.indexOf('--fetch-meta') + 1];
  if (!url) { console.error('Usage: node facebook-events.js --fetch-meta <url>'); process.exit(1); }
  fetchFacebookMeta(url).then(meta => {
    console.log('\n── Facebook OG metadata ─────────────────────────────────');
    console.log(`  title:    ${meta.title}`);
    console.log(`  date:     ${meta.date}`);
    console.log(`  location: ${meta.location}`);
    console.log(`  image:    ${meta.imageUrl}`);
    console.log(`  raw desc: ${meta.description}`);
    console.log('\nCopy this into the EVENTS array and fill in the rest.\n');
  }).catch(err => { console.error(err.message); process.exit(1); });
  // Don't fall through to main()
} else {

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

  // ── https://www.facebook.com/events/3374098399435770 ──────────────────
  // OG meta auto-fetched 2026-05-21 · lineup/price/image: fill in manually
  {
    title:    '10 Jahre Habgier + Birthday Bash',
    slug:     '10-jahre-habgier-birthday-bash-2026',
    date:     '2026-05-22',                              // Freitag, 22. Mai 2026
    strip:    '22. Mai 2026 | KulturCafé Hinkofer, Viechtach | Vaida is not dead e.V. × Habgier',
    image:    null,                                      // TODO: add poster image path
    featured: false,
    facebook: 'https://www.facebook.com/events/3374098399435770',
    content: `
      <p>
        10 Jahre Habgier – das wird gefeiert! Vaida is not dead e.V. und Habgier
        laden ein zu einer Jubiläumsnacht im KulturCafé Hinkofer, Viechtach.
      </p>

      <h2>Line-up</h2>
      <ul>
        <li><strong>TODO: Band 1</strong></li>
        <li><strong>TODO: Band 2</strong></li>
      </ul>

      <!-- TODO: After-Show / Keller-Info ergänzen -->
      <!-- TODO: Einlass-Zeit und AK-Preis ergänzen -->

      <p>No Idiots – No Nazis – No Sexists – No AfD</p>

      <p>
        <a href="https://www.facebook.com/events/3374098399435770" target="_blank" rel="noopener">Facebook-Veranstaltungsseite</a>
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
}
