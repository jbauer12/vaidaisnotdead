# vaidaisnotdead
Ghost Template from the website of the organization Vaida is not dead e.V.

> Production hosting follows [Self-hosting Ghost on Google Cloud (always free)](https://scottleechua.com/blog/self-hosting-ghost-on-google-cloud/).

## Local Development

Start the stack from the `debugging/` directory:

```sh
cd debugging
docker compose up
```

| Service | URL |
|---------|-----|
| Ghost | http://localhost:2368 |
| Ghost Admin | http://localhost:2368/ghost |
| Mailpit (emails) | http://localhost:8025 |
| Adminer (database) | http://localhost:8090 |
| MySQL | localhost:3306 (user: `ghost`, password: `ghost`) |

The `theme/` directory and `routes.yaml` are mounted live into Ghost — changes reflect without restarting the container.

On first boot, activate the theme once via **Admin → Settings → Design → Change theme → vaida → Activate**. It is stored in the database and persists across restarts.

## Seeding content (init scripts)

The `init_scripts/` directory contains scripts that push base content (pages, FAQ, events, site settings) into Ghost via the Admin API.

### One-time setup

**1. Start Ghost and finish the setup wizard**

```sh
cd debugging && docker compose up
```

Open [localhost:2368/ghost](http://localhost:2368/ghost) and create your admin account.

**2. Create an Admin API key**

Admin → Settings → Integrations → **Add custom integration** → copy the **Admin API Key**.

**3. Paste it into the `.env`**

```sh
# init_scripts/.env
GHOST_LOCAL_ADMIN_API_KEY=<paste here>
```

**4. Install dependencies and run**

```sh
cd init_scripts
npm install
node setup-local.js
```

This runs the following scripts in order:

| Script | What it does |
|--------|-------------|
| `ghost-sdk-example.js` | Site settings, navigation, Impressum, Datenschutz, FAQ posts, gallery |
| `setup-pages.js` | Stub pages — Kontakt, Events, Galerie, Mitglied werden |
| `events.js` | Current events |

### Running scripts individually

Every script accepts `--local` (localhost:2368) or no flag (production):

```sh
node events.js --local        # push events to local Ghost
node events.js                # push events to production
```

`facebook-events.js` is a one-off template — fill in the event details and run it manually.

### Login after logout

Ghost sends a magic link instead of a password prompt. After clicking "Sign in" in the admin, open [Mailpit](http://localhost:8025) and click the link in the email that arrives there.
