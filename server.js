// TechPulse backend: collects tech news, sends Web Push hourly + daily.
const express = require('express'), fs = require('fs'), cron = require('node-cron');
const webpush = require('web-push'), Parser = require('rss-parser');
const path = require('path'), crypto = require('crypto');
const parser = new Parser({ timeout: 30000 });
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const dataFile = name => path.join(DATA_DIR, name);
fs.mkdirSync(DATA_DIR, { recursive: true });
const gnews = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=en&gl=US&ceid=US:en`;
const companies = JSON.parse(fs.readFileSync(path.join(__dirname, 'companies.json'), 'utf8'));
const youtubeChannelIds = (process.env.YOUTUBE_CHANNEL_IDS || '').split(',').map(x => x.trim()).filter(x => /^[\w-]+$/.test(x));
const safeRssUrls = value => (value || '').split(',').map(x => x.trim()).filter(x => {
  try { return new URL(x).protocol === 'https:'; } catch { return false; }
});
const tiktokFeeds = safeRssUrls(process.env.TIKTOK_RSS_FEEDS);
const extraRssFeeds = (process.env.TECH_EXTRA_RSS_FEEDS || '').split(',').flatMap(entry => {
  const [label, url] = entry.split('|').map(x => x.trim());
  if (!label || !url) return [];
  try { return new URL(url).protocol === 'https:' ? [{ label, url }] : []; } catch { return []; }
});

// ---- Sources per topic (edit freely) ----
const TOPICS = {
  ai:       { label: 'AI & Models',        feeds: [gnews('new AI model release OR OpenAI OR Anthropic OR Gemini'), 'https://hnrss.org/newest?q=LLM&points=100'] },
  languages:{ label: 'Programming Languages', feeds: ['https://blog.python.org/feeds/posts/default?alt=rss', 'https://blog.rust-lang.org/feed.xml', gnews('Python OR JavaScript OR Rust OR Go release new version')] },
  business: { label: 'Funding & Competition', feeds: [gnews('tech startup funding round billion'), gnews('big tech competition AI race')] },
  security: { label: 'Cybersecurity', feeds: [gnews('cybersecurity OR data breach OR vulnerability security patch')] },
  hardware: { label: 'Hardware & Semiconductors', feeds: [gnews('semiconductors OR GPU OR processor chip technology')] },
  cloud:    { label: 'Cloud & Data Centers', feeds: [gnews('cloud computing OR data center OR edge computing')] },
  ethiopia: { label: 'Ethiopia Tech',       feeds: [gnews('Ethiopia tech startup'), gnews('Ethiopia Telebirr OR Safaricom Ethiopia OR Ethio telecom digital'), gnews('Addis Ababa innovation software company')] },
  companies:{ label: 'Company updates',     feeds: [gnews('"Ethio telecom" OR "Safaricom Ethiopia" OR Kifiya OR Gebeya OR Chapa OR ArifPay OR "Qene Games"')] },
  youtube:  { label: 'YouTube technology videos', feeds: youtubeChannelIds.map(id => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`) },
  telegram: { label: 'Telegram channel updates', feeds: [] },
  tiktok:   { label: 'TikTok technology updates', feeds: tiktokFeeds },
  websites: { label: 'Technology websites', feeds: extraRssFeeds.map(feed => feed.url) },
};

// ---- Storage (simple JSON files; swap for a DB in production) ----
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f)); } catch { return d; } };
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v));
let vapid = read(dataFile('vapid.json'), null);
if (!vapid) { vapid = webpush.generateVAPIDKeys(); write(dataFile('vapid.json'), vapid); }
webpush.setVapidDetails(process.env.CONTACT || 'mailto:admin@example.com', vapid.publicKey, vapid.privateKey);
let subs = read(dataFile('subs.json'), []);       // [{sub, hourly, daily, topics:[]}]
let sent = new Set(read(dataFile('sent.json'), [])); // links already pushed hourly

// ---- Fetch + cache ----
const cache = {};
const socialFile = dataFile('social-articles.json');
let socialArticles = read(socialFile, []);
global.techSocialArticles = socialArticles;
function uniqueArticles(articles) {
  const seen = new Set();
  return articles.filter(item => {
    const key = item.link || `${item.topic}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function saveSocialArticle(article) {
  const index = socialArticles.findIndex(item => item.link && item.link === article.link);
  if (index >= 0) socialArticles[index] = article;
  else socialArticles.unshift(article);
  socialArticles = socialArticles.slice(0, 5000);
  global.techSocialArticles = socialArticles;
  fs.writeFileSync(socialFile, JSON.stringify(socialArticles));
}
async function fetchTopic(key) {
  const out = [];
  for (const url of TOPICS[key].feeds) {
    try { const f = await parser.parseURL(url);
      f.items.slice(0, 8).forEach(i => {
        let source = '';
        try { source = new URL(i.link).hostname; } catch {}
        out.push({
          topic: key,
          title: (i.title || '').trim(),
          summary: (i.contentSnippet || i.summary || '').trim().slice(0, 2000),
          source,
          link: i.link,
          date: new Date(i.isoDate || i.pubDate || Date.now()).getTime(),
        });
      });
    } catch (e) { console.warn('feed failed', url.slice(0, 60), e.message); }
  }
  const seen = new Set();
  return out.filter(i => i.title && !seen.has(i.title) && seen.add(i.title)).sort((a, b) => b.date - a.date).slice(0, 15);
}
async function refresh() { for (const k of Object.keys(TOPICS)) cache[k] = await fetchTopic(k); if (global.onRefresh) global.onRefresh(cache); console.log('feeds refreshed', new Date().toISOString()); }

// Optional AI one-line digest via Claude API
async function aiDigest(items) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', max_tokens: 300,
        messages: [{ role: 'user', content: 'Summarize these tech headlines into a 3-bullet digest, max 280 chars total, no hype:\n' + items.map(i => '- ' + i.title).join('\n') }] }) });
    return (await r.json()).content?.[0]?.text || null;
  } catch { return null; }
}

// ---- Push helpers ----
async function push(s, payload) {
  try { await webpush.sendNotification(s.sub, JSON.stringify(payload)); }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { subs = subs.filter(x => x !== s); write(dataFile('subs.json'), subs); } }
}
// Hourly: newest unseen headline from the user's topics
async function hourly() {
  await refresh();
  for (const s of subs.filter(x => x.hourly)) {
    const pool = s.topics.flatMap(t => cache[t] || []).sort((a, b) => b.date - a.date);
    const item = pool.find(i => !sent.has(s.sub.endpoint + i.link));
    if (!item) continue;
    sent.add(s.sub.endpoint + item.link);
    await push(s, { title: '⚡ ' + TOPICS[item.topic].label, body: item.title, url: item.link, tag: 'hourly' });
  }
  write(dataFile('sent.json'), [...sent].slice(-5000));
}
// Daily digest at 07:00 Ethiopia time
async function daily() {
  await refresh();
  for (const s of subs.filter(x => x.daily)) {
    const top = s.topics.flatMap(t => (cache[t] || []).slice(0, 2)).sort((a, b) => b.date - a.date).slice(0, 6);
    if (!top.length) continue;
    const body = (await aiDigest(top)) || top.map(i => '• ' + i.title).join('\n');
    await push(s, { title: '📰 Your daily tech brief', body, url: '/', tag: 'daily' });
  }
}
cron.schedule('0 * * * *', hourly);
cron.schedule('0 7 * * *', daily, { timezone: 'Africa/Addis_Ababa' });

// ---- API + static ----
const app = express();
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.json());
app.use(express.static(frontendDist));
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/api/vapid', (_, res) => res.json({ key: vapid.publicKey }));
app.get('/api/topics', (_, res) => res.json(Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, v.label]))));
app.get('/api/sources', (_, res) => res.json({
  updated: new Date().toISOString(),
  sources: [
    { id: 'websites', label: 'News and technology websites', configured: true, detail: 'Google News RSS and configured website RSS feeds', feeds: TOPICS.ai.feeds.length + TOPICS.languages.feeds.length + TOPICS.business.feeds.length + TOPICS.security.feeds.length + TOPICS.hardware.feeds.length + TOPICS.cloud.feeds.length + TOPICS.ethiopia.feeds.length + TOPICS.companies.feeds.length + extraRssFeeds.length },
    { id: 'youtube', label: 'YouTube', configured: youtubeChannelIds.length > 0, detail: youtubeChannelIds.length ? `${youtubeChannelIds.length} channel RSS feeds configured` : 'Set YOUTUBE_CHANNEL_IDS to public channel IDs to enable official channel feeds' },
    { id: 'telegram', label: 'Telegram', configured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET), detail: process.env.TELEGRAM_WEBHOOK_SECRET ? 'Webhook enabled; bot must be added to the channel to receive channel posts' : 'Set TELEGRAM_WEBHOOK_SECRET and configure a Telegram bot webhook' },
    { id: 'tiktok', label: 'TikTok', configured: tiktokFeeds.length > 0, detail: tiktokFeeds.length ? `${tiktokFeeds.length} administrator-configured HTTPS RSS feeds` : 'No TikTok feed configured; use an authorized provider or approved TikTok API access' },
    { id: 'github', label: 'GitHub', configured: true, detail: process.env.GITHUB_TOKEN ? 'Public API with configured token' : 'Public API (unauthenticated rate limits apply)' },
  ],
}));
app.get('/api/companies', (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase().slice(0, 100);
  const country = String(req.query.country || '').trim().toLowerCase();
  const sector = String(req.query.sector || '').trim().toLowerCase();
  const articles = uniqueArticles([...Object.values(cache).flat(), ...socialArticles, ...Object.values(global.techArchive || {})]);
  const result = companies.filter(company => {
    const matchesCountry = !country || company.country.toLowerCase() === country;
    const matchesSector = !sector || company.sectors.some(item => item.toLowerCase() === sector);
    const searchable = `${company.name} ${company.country} ${company.sectors.join(' ')} ${company.description}`.toLowerCase();
    return matchesCountry && matchesSector && (!query || searchable.includes(query));
  }).map(company => ({
    ...company,
    latestCoverage: articles.filter(article =>
      article.title?.toLowerCase().includes(company.name.toLowerCase()),
    ).sort((a, b) => b.date - a.date).slice(0, 3),
  }));
  res.json({ companies: result, count: result.length, directoryUpdated: '2026-10-28' });
});
app.get('/api/feed', (req, res) => { const t = (req.query.topics || Object.keys(TOPICS).join(',')).split(',');
  const items = t.flatMap(k => cache[k] || []).concat(t.includes('telegram') ? socialArticles : []);
  res.json(uniqueArticles(items).sort((a, b) => b.date - a.date).slice(0, 100)); });
app.post('/api/ingest/telegram', (req, res) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const received = req.get('x-telegram-bot-api-secret-token') || '';
  if (!expected) return res.status(503).json({ error: 'Telegram webhook is not configured' });
  const expectedBuffer = Buffer.from(expected), receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return res.sendStatus(401);
  }
  const message = req.body?.channel_post;
  const text = message?.text || message?.caption || '';
  if (!message || !text.trim()) return res.json({ ok: true, ignored: true });
  const username = message.chat?.username;
  const link = username && message.message_id ? `https://t.me/${username}/${message.message_id}` : '';
  saveSocialArticle({
    topic: 'telegram',
    title: text.trim().split(/\r?\n/)[0].slice(0, 300),
    summary: text.trim().slice(0, 2000),
    link,
    source: username ? `Telegram @${username}` : 'Telegram channel',
    date: Number(message.date) * 1000 || Date.now(),
  });
  return res.json({ ok: true });
});
app.post('/api/subscribe', (req, res) => { const { sub, hourly = true, daily = true, topics = Object.keys(TOPICS) } = req.body;
  if (!sub?.endpoint) return res.sendStatus(400);
  subs = subs.filter(s => s.sub.endpoint !== sub.endpoint); subs.push({ sub, hourly, daily, topics }); write(dataFile('subs.json'), subs); res.json({ ok: true }); });
app.post('/api/unsubscribe', (req, res) => { subs = subs.filter(s => s.sub.endpoint !== req.body.endpoint); write(dataFile('subs.json'), subs); res.json({ ok: true }); });
app.post('/api/test', async (req, res) => { const s = subs.find(x => x.sub.endpoint === req.body.endpoint);
  if (s) await push(s, { title: 'TechPulse works ✅', body: 'You will get alerts even when the app is closed.', url: '/' }); res.json({ ok: !!s }); });
require('./insights')(app, companies);
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(frontendDist, 'index.html'), error => error && next(error));
});
app.listen(PORT, '0.0.0.0', () => {
  console.log('TechPulse on :' + PORT);
  refresh().catch(error => console.error('initial feed refresh failed', error));
});
