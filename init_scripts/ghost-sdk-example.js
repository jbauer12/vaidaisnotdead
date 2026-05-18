// ghost-sdk-example.js
//
// Sets up the full base content for vaidaisnotdead Ghost CMS.
// Run with: node ghost-sdk-example.js
//
// NOTE: Events are managed separately in events.js / facebook-events.js

import 'dotenv/config';
import GhostAdminAPI from '@tryghost/admin-api';
import { createHmac } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const LOCAL = process.argv.includes('--local');

const ADMIN_API_KEY = LOCAL ? process.env.GHOST_LOCAL_ADMIN_API_KEY : process.env.GHOST_ADMIN_API_KEY;
const GHOST_URL     = LOCAL ? process.env.GHOST_LOCAL_URL : process.env.GHOST_URL;

const api = new GhostAdminAPI({ url: GHOST_URL, key: ADMIN_API_KEY, version: 'v5.0' });

// ── Helpers ────────────────────────────────────────────────────────────

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
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] ?? 'image/jpeg';
}

async function restPost(resource, data) {
  const res  = await fetch(`${GHOST_URL}/ghost/api/admin/${resource}/?source=html`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${ghostJwt()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ [resource]: [data] }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? res.statusText);
  return json[resource][0];
}

async function restPut(resource, id, updated_at, data) {
  const res  = await fetch(`${GHOST_URL}/ghost/api/admin/${resource}/${id}/?source=html`, {
    method: 'PUT',
    headers: { Authorization: `Ghost ${ghostJwt()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ [resource]: [{ ...data, updated_at }] }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? res.statusText);
  return json[resource][0];
}

async function uploadImage(filePath, purpose = 'image') {
  if (!filePath || !existsSync(filePath)) {
    if (filePath) console.warn(`  ⚠  image not found: ${filePath}`);
    return null;
  }
  const form = new FormData();
  form.append('file', new Blob([readFileSync(filePath)], { type: mime(filePath) }), filePath.split('/').pop());
  form.append('purpose', purpose);
  const res  = await fetch(`${GHOST_URL}/ghost/api/admin/images/upload/`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${ghostJwt()}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'image upload failed');
  const url = json.images[0].url;
  console.log(`  → image: ${url}`);
  return url;
}

async function deletePost(slug) {
  const posts = await api.posts.browse({ filter: `slug:${slug}`, fields: 'id' });
  for (const p of posts) await api.posts.delete({ id: p.id });
}

async function upsertPage(slug, data) {
  const existing = await api.pages.browse({ filter: `slug:${slug}`, fields: 'id,updated_at' });
  if (existing.length) {
    return restPut('pages', existing[0].id, existing[0].updated_at, data);
  }
  return restPost('pages', data);
}

async function upsertPost(slug, data) {
  const existing = await api.posts.browse({ filter: `slug:${slug}`, fields: 'id,updated_at' });
  if (existing.length) {
    return restPut('posts', existing[0].id, existing[0].updated_at, data);
  }
  return restPost('posts', data);
}

// ── Clean up stale content ─────────────────────────────────────────────

async function cleanStale() {
  const STALE_SLUGS = [
    'sommerfest-2026', 'sommerfest-2026-2', 'sommerfest-2026-3', 'sommerfest-2026-4',
    'coming-soon',
    'konzertabend-mai-2026',
  ];
  for (const slug of STALE_SLUGS) await deletePost(slug);
}

// ── Pages ──────────────────────────────────────────────────────────────

async function createDatenschutz() {
  return upsertPage('datenschutz', {
    title:  'Datenschutzerklärung',
    slug:   'datenschutz',
    status: 'published',
    html: `
      <h2>1. Verantwortliche Stelle</h2>
      <p>
        Vaida is not dead e.V.<br>
        E-Mail: <a href="mailto:info@vaidaisnotdead.de">info@vaidaisnotdead.de</a>
      </p>

      <h2>2. Erhebung und Speicherung personenbezogener Daten</h2>
      <p>
        Beim Besuch unserer Website werden durch den Browser automatisch Informationen
        an den Server unserer Website gesendet. Diese Informationen werden temporär in
        einem sogenannten Logfile gespeichert. Folgende Informationen werden dabei ohne
        Ihr Zutun erfasst und bis zur automatisierten Löschung gespeichert:
      </p>
      <ul>
        <li>IP-Adresse des anfragenden Rechners</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>Name und URL der abgerufenen Datei</li>
        <li>Website, von der aus der Zugriff erfolgt (Referrer-URL)</li>
        <li>Verwendeter Browser und ggf. das Betriebssystem Ihres Rechners</li>
      </ul>

      <h2>3. Kontaktaufnahme</h2>
      <p>
        Bei Ihrer Kontaktaufnahme mit uns per E-Mail werden die von Ihnen mitgeteilten
        Daten (Ihre E-Mail-Adresse, ggf. Ihr Name und Ihre Telefonnummer) von uns
        gespeichert, um Ihre Fragen zu beantworten. Die in diesem Zusammenhang
        anfallenden Daten löschen wir, nachdem die Speicherung nicht mehr erforderlich
        ist, oder schränken die Verarbeitung ein, falls gesetzliche
        Aufbewahrungspflichten bestehen.
      </p>

      <h2>4. Ihre Rechte</h2>
      <p>Sie haben das Recht auf:</p>
      <ul>
        <li>Auskunft über Ihre bei uns gespeicherten personenbezogenen Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger personenbezogener Daten (Art. 16 DSGVO)</li>
        <li>Löschung Ihrer bei uns gespeicherten Daten (Art. 17 DSGVO)</li>
        <li>Einschränkung der Datenverarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung Ihrer Daten (Art. 21 DSGVO)</li>
      </ul>
      <p>
        Zur Geltendmachung Ihrer Rechte wenden Sie sich bitte an:
        <a href="mailto:info@vaidaisnotdead.de">info@vaidaisnotdead.de</a>
      </p>

      <h2>5. Beschwerderecht</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutzbehörde über die Verarbeitung
        Ihrer personenbezogenen Daten durch uns zu beschweren.
      </p>
    `,
  });
}

async function createImpressum() {
  return upsertPage('impressum', {
    title:  'Impressum',
    slug:   'impressum',
    status: 'published',
    html: `
      <h2>Angaben gemäß § 5 TMG</h2>
      <p>
        Vaida is not dead e.V.<br>
        E-Mail: <a href="mailto:info@vaidaisnotdead.de">info@vaidaisnotdead.de</a>
      </p>

      <h2>Verein</h2>
      <p>
        Vaida is not dead e.V. ist ein eingetragener gemeinnütziger Verein.<br>
        Vereinszweck: Förderung von Konzerten, Subkultur und kulturellem Leben.
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:info@vaidaisnotdead.de">info@vaidaisnotdead.de</a><br>
        Instagram: <a href="https://instagram.com/vaidaisnotdead" target="_blank">@vaidaisnotdead</a><br>
        Facebook: <a href="https://facebook.com/vaidaisnotdead" target="_blank">Vaida is not dead</a>
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10
        TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
        gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
        forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte
        wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch
        keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der
        jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
        unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche
        gekennzeichnet. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art
        der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
        schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
      </p>
    `,
  });
}

async function createMitgliedWerden() {
  // The page-mitglied-werden.hbs template renders the full content.
  // This page just needs to exist so Ghost can route to that template.
  return upsertPage('mitglied-werden', {
    title:  'Mitglied werden',
    slug:   'mitglied-werden',
    status: 'published',
    html:   '',
  });
}

async function createUeberUns(imagePath) {
  const featureImage = await uploadImage(imagePath);
  return upsertPage('ueber-uns', {
    title:  'Vaida is not dead e.V.',
    slug:   'ueber-uns',
    status: 'published',
    ...(featureImage && { feature_image: featureImage }),
    html: `
      <p>
        Gemeinnütziger Verein aus Viechtach im Bayerischen Wald.
        Wir machen Konzerte, Sessions und Abende, die sonst nicht stattfinden würden –
        <strong>direkt, ohne Dresscode, ohne Türpolitik.</strong>
      </p>
      <p>
        Entstanden aus dem Wunsch, im ländlichen Raum echte Subkultur dauerhaft möglich zu machen.
        <strong>Nicht von oben geplant – sondern von den Leuten, die hier leben.</strong>
      </p>
    `,
  });
}

// ── FAQ posts (title = Frage, content = Antwort) ───────────────────────
// The /faq/ route is a channel that shows posts tagged "faq".

const FAQ_ENTRIES = [
  {
    slug:    'faq-was-ist-vaida',
    title:   'Was ist Vaida is not dead e.V.?',
    excerpt: 'Ein gemeinnütziger Verein aus Viechtach, der Konzerte, Subkultur und kulturelles Leben fördert. Wir organisieren Veranstaltungen, unterstützen lokale Bands und vernetzen Menschen aus der Szene.',
  },
  {
    slug:    'faq-mitglied-werden',
    title:   'Wie kann ich Mitglied werden?',
    excerpt: 'Schreib uns eine E-Mail an info@vaidaisnotdead.de – wir schicken dir alles Weitere zu. Mehr Infos auf der Mitglied-werden-Seite.',
  },
  {
    slug:    'faq-veranstaltungen-erfahren',
    title:   'Wie erfahre ich von kommenden Veranstaltungen?',
    excerpt: 'Folge uns auf Instagram und Facebook oder schau regelmäßig unter /events/ vorbei.',
  },
  {
    slug:    'faq-veranstaltung-einreichen',
    title:   'Kann ich eine Band vorschlagen oder eine Veranstaltung einreichen?',
    excerpt: 'Sehr gerne! Schreib uns einfach an info@vaidaisnotdead.de.',
  },
  {
    slug:    'faq-veranstaltungsorte',
    title:   'Wo finden eure Veranstaltungen statt?',
    excerpt: 'Das variiert. Locations werden jeweils in der Veranstaltungsankündigung bekannt gegeben – meist im Großraum Viechtach.',
  },
  {
    slug:    'faq-unterstuetzen',
    title:   'Wie kann ich den Verein unterstützen, ohne Mitglied zu werden?',
    excerpt: 'Komm zu unseren Veranstaltungen, teile unsere Posts oder sprich uns direkt an – wir freuen uns über jede Unterstützung.',
  },
];

async function createFaqPosts() {
  for (const entry of FAQ_ENTRIES) {
    await upsertPost(entry.slug, {
      title:          entry.title,
      slug:           entry.slug,
      status:         'published',
      custom_excerpt: entry.excerpt,
      tags:           [{ name: 'FAQ', slug: 'faq' }],
      html:           `<p>${entry.excerpt}</p>`,
    });
  }
}

// ── Gallery ────────────────────────────────────────────────────────────

async function createGalleryPost(imagePath) {
  const featureImage = await uploadImage(imagePath);
  return upsertPost('galerie-konzertabend-april-2026', {
    title:          'Galerie – Konzertabend April 2026',
    slug:           'galerie-konzertabend-april-2026',
    status:         'published',
    tags:           [{ name: 'Galerie', slug: 'galerie' }],
    custom_excerpt: 'Konzertabend im April 2026 – Impressionen, Poster und Eindrücke vom Abend.',
    ...(featureImage && { feature_image: featureImage }),
    html: featureImage
      ? `<figure><img src="${featureImage}" alt="Konzertabend April 2026"></figure>
         <p>Fotos vom Konzertabend im April 2026. Danke an alle Bands und Gäste!</p>`
      : `<p>Fotos vom Konzertabend im April 2026. Danke an alle Bands und Gäste!</p>`,
  });
}

// ── Site settings ──────────────────────────────────────────────────────

async function updateSiteSettings({ iconPath, logoPath, coverPath } = {}) {
  const settings = [
    { key: 'title',       value: 'Vaida is not dead e.V.' },
    { key: 'description', value: 'Jugend- und Subkultur in Viechtach. Direkt, reduziert und auf echte Abende ausgerichtet.' },
    { key: 'lang',        value: 'de' },
    { key: 'facebook',    value: 'vaidaisnotdead' },
  ];

  if (iconPath)  { const url = await uploadImage(iconPath, 'icon');  if (url) settings.push({ key: 'icon',        value: url }); }
  if (logoPath)  { const url = await uploadImage(logoPath);          if (url) settings.push({ key: 'logo',        value: url }); }
  if (coverPath) { const url = await uploadImage(coverPath);         if (url) settings.push({ key: 'cover_image', value: url }); }

  settings.push({
    key: 'navigation',
    value: JSON.stringify([
      { label: 'Home',            url: '/' },
      { label: 'Galerie',         url: '/galerie/' },
      { label: 'Events',          url: '/events/' },
      { label: 'Mitglied werden', url: '/mitglied-werden/' },
      { label: 'FAQ',             url: '/faq/' },
    ]),
  });

  settings.push({
    key: 'secondary_navigation',
    value: JSON.stringify([
      { label: 'Impressum',            url: '/impressum/' },
      { label: 'Datenschutzerklärung', url: '/datenschutz/' },
    ]),
  });

  const res = await fetch(`${GHOST_URL}/ghost/api/admin/settings/`, {
    method: 'PUT',
    headers: { Authorization: `Ghost ${ghostJwt()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  return res.json();
}

// ── Runner ─────────────────────────────────────────────────────────────

async function run(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
  }
}

async function main() {
  console.log('\n── Cleanup ──────────────────────────────────────────────');
  await run('stale posts', cleanStale);

  console.log('\n── Pages ────────────────────────────────────────────────');
  await run('Datenschutzerklärung', createDatenschutz);
  await run('Impressum',            createImpressum);
  await run('Mitglied werden',      createMitgliedWerden);
  await run('Über uns',             () => createUeberUns('./vaidaisnotdeadhintergund.jpg'));

  console.log('\n── FAQ posts ────────────────────────────────────────────');
  await run('FAQ-Einträge',         createFaqPosts);

  console.log('\n── Gallery ──────────────────────────────────────────────');
  await run('Galerie-Post',         () => createGalleryPost('./event-detail-01.jpg'));

  console.log('\n── Site settings ────────────────────────────────────────');
  await run('Settings + Navigation', () => updateSiteSettings({
    iconPath:  './vaidaisnotdead-logo.png',
    logoPath:  './logo_vaisnd.png',
    coverPath: './big_logo_home_site.jpg',
  }));

  console.log('\nDone.\n');
}

main().catch(console.error);
