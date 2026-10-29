# SignalTech

SignalTech is a React dashboard that combines technology headlines with short,
topic-specific explanations. It reads live results from the TechPulse API and
historical research data from that API; it does not bundle a fabricated news or
market database.

## Run locally

For local development, install backend dependencies once, then start the
backend from the project folder:

```powershell
cd C:\Users\AAAAAAA\Desktop\tech-info
npm install
npm start
```

In a second window, start the frontend:

```powershell
cd C:\Users\AAAAAAA\Desktop\tech-info\frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`. The Vite
development server proxies `/api` requests to `http://localhost:3000`. If you
change the backend topic list, restart the backend so it reloads its feeds.

## Host on Render

The root `render.yaml` configures one Node web service: Render builds the Vite
frontend, Express serves the built page and API from one HTTPS origin, and a
persistent disk at `/var/data` stores the news archive, collected Telegram
posts, push subscriptions, and push keys.

1. Publish **the contents of this `tech-info` folder only** as a GitHub
   repository. Do not publish the whole Desktop folder: it contains unrelated
   personal files. The `git` command-line tool is not required; GitHub Desktop
   can publish this project folder.
2. In Render, choose **New → Blueprint**, connect that GitHub repository, and
   apply the `render.yaml` blueprint. Review Render's current plan and disk
   charges before confirming; persistent disks require a paid service.
3. In the Render service's environment settings, replace the example `CONTACT`
   value with an email address you control, in `mailto:you@example.com` format.
   Add optional API keys and social-source settings there—not in committed
   files. Deploy and wait for `/api/health` to pass.
4. Open the public `https://...onrender.com` service URL. The frontend and
   backend share that URL; Vite's local development proxy is not involved in
   production.

The persistent disk protects local JSON data when the same service restarts or
deploys, but it is not a database backup or multi-instance storage strategy.
For a larger production service, migrate archives, subscriptions, and company
records to managed PostgreSQL and configure backups.

The project is now self-contained in this folder: `server.js`, `insights.js`,
`companies.json`, `package.json`, `render.yaml`, and the `frontend` directory.
The backend serves the compiled frontend itself; `/api/health` is Render's
health-check endpoint. Do not copy the files back into or publish the entire
Desktop folder.

## Search and company directory

The search API searches collected and archived headlines plus the company
directory. The initial directory is a curated starting list, not a complete
worldwide company database. Company profiles do not establish current operation,
licensing, solvency, hiring, or product availability. Check linked official
company and regulator sources for current status.

## Optional publisher and social feeds

The backend checks RSS sources during its hourly refresh. Configure optional
sources in the backend process environment; keep credentials out of source
files and public repositories.

- `YOUTUBE_CHANNEL_IDS`: comma-separated public YouTube channel IDs. The server
  reads each channel's official video RSS feed.
- `TECH_EXTRA_RSS_FEEDS`: comma-separated `Label|https://feed-url` entries for
  additional public publisher or project RSS feeds.
- `TIKTOK_RSS_FEEDS`: comma-separated HTTPS RSS feeds from a provider you are
  authorized to use. TikTok access may require approval; the app does not scrape
  TikTok pages or bypass access controls.
- `TELEGRAM_WEBHOOK_SECRET`: secret configured on a Telegram bot webhook at
  `/api/ingest/telegram`. The deployed server needs a public HTTPS URL, and the
  bot must be added to the public channel with appropriate permissions to
  receive channel posts. Telegram bot tokens must remain private and are not
  needed by this application endpoint.

YouTube channel feeds and administrator-configured RSS feeds are opt-in. The
Telegram webhook only records channel posts Telegram delivers to the configured
bot. The source-status panel reports configuration, not guaranteed provider
uptime or completeness.

## Data sources and limitations

- Google News RSS and configured publisher RSS feeds provide current headlines.
- Optional YouTube channel feeds, authorized TikTok RSS sources, and Telegram
  bot webhooks can add social/video updates when configured by the operator.
- Hacker News and its Algolia API provide discussion counts used as a limited
  developer-interest signal.
- GitHub's public API provides repository stars and release metadata.
- endoflife.date provides software lifecycle information.
- AI-assisted research notes appear only when the backend has an AI provider
  configured.

Feed coverage is selective and can be delayed or temporarily unavailable.
Social platforms do not provide unrestricted access to every public post;
credentials, channel permissions, and provider terms may limit collection.
Hacker News mentions do not measure all developers or language usage. The
dashboard does not provide live stock or cryptocurrency prices and is not
investment advice. Verify important claims using the linked publisher and
official project documentation.
