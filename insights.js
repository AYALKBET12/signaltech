// insights.js: real APIs -> history, archive and evidence-based forecast.
// Sources: Hacker News (Algolia) API, endoflife.date API, GitHub API, optional Claude API.
const fs = require('fs'), cron = require('node-cron');
const path = require('path');
const DATA_DIR = process.env.DATA_DIR || __dirname;
const dataFile = name => path.join(DATA_DIR, name);
const J = (f, d) => { try { return JSON.parse(fs.readFileSync(f)); } catch { return d; } };
const TERMS = ['Python', 'Rust', 'TypeScript', 'Kotlin', 'machine learning', 'LLM', 'Ethiopia'];
const PRODUCTS = ['python', 'nodejs', 'go', 'rust', 'kotlin'];
const REPOS = ['python/cpython', 'rust-lang/rust', 'golang/go', 'microsoft/TypeScript', 'huggingface/transformers', 'ollama/ollama'];
const get = async (u, h = {}) => { const r = await fetch(u, { headers: { 'user-agent': 'techpulse', ...h } }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const now = new Date(), Y = now.getUTCFullYear(), frac = (now - Date.UTC(Y, 0, 1)) / (365 * 864e5);

// Yearly count of Hacker News stories mentioning a term (proxy for developer attention). Current year is annualized.
async function mentions(q) {
  const out = [];
  for (let y = 2012; y <= Y; y++) {
    const a = Date.UTC(y, 0, 1) / 1e3, b = Date.UTC(y + 1, 0, 1) / 1e3;
    try {
      const d = await get(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent('"' + q + '"')}&tags=story&hitsPerPage=0&numericFilters=created_at_i>=${a},created_at_i<${b}`);
      out.push([y, y === Y ? Math.round(d.nbHits / frac) : d.nbHits]);
    } catch {}
  }
  return out;
}
// Least-squares line over last 6 years -> next 2 years, with R² as the confidence measure.
function forecast(h) {
  const p = h.slice(-6), n = p.length, mx = p.reduce((s, a) => s + a[0], 0) / n, my = p.reduce((s, a) => s + a[1], 0) / n;
  const sxx = p.reduce((s, a) => s + (a[0] - mx) ** 2, 0), sxy = p.reduce((s, a) => s + (a[0] - mx) * (a[1] - my), 0);
  const m = sxy / sxx, b = my - m * mx, syy = p.reduce((s, a) => s + (a[1] - my) ** 2, 0);
  const r2 = syy ? 1 - p.reduce((s, a) => s + (a[1] - (m * a[0] + b)) ** 2, 0) / syy : 0;
  const fc = [1, 2].map(k => [Y + k, Math.max(0, Math.round(m * (Y + k) + b))]), last = p[n - 1][1];
  return { fc, perYear: Math.round(m), r2: +r2.toFixed(2), conf: r2 > .8 ? 'strong' : r2 > .5 ? 'moderate' : 'weak', changePct: last ? Math.round((fc[1][1] - last) / last * 100) : null, last };
}
async function releases() {
  const o = {};
  for (const p of PRODUCTS) try { o[p] = (await get(`https://endoflife.date/api/${p}.json`)).slice(0, 6).map(x => ({ v: x.cycle, date: x.releaseDate, latest: x.latest })); } catch {}
  return o;
}
async function repos() {
  const h = process.env.GITHUB_TOKEN ? { authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}, out = [];
  for (const r of REPOS) try {
    const d = await get('https://api.github.com/repos/' + r, h); let rel = null;
    try { rel = await get(`https://api.github.com/repos/${r}/releases/latest`, h); } catch {}
    const perDay = d.stargazers_count / ((Date.now() - new Date(d.created_at)) / 864e5);
    out.push({ repo: r, stars: d.stargazers_count, created: d.created_at.slice(0, 10), latest: rel && rel.tag_name, latestDate: rel && rel.published_at.slice(0, 10), starsNextYear: Math.round(d.stargazers_count + perDay * 365) });
  } catch {}
  return out;
}
async function analyze(ev) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', max_tokens: 500,
        messages: [{ role: 'user', content: 'Using ONLY this data, write 5 short bullets on likely tech trends. Cite the numbers, state uncertainty and low-R² cases, no guarantees.\n' + JSON.stringify(ev) }] }) });
    return (await r.json()).content?.[0]?.text || null;
  } catch { return null; }
}
let ins = J(dataFile('insights.json'), null);
async function build() {
  const history = {}, fc = {};
  for (const t of TERMS) { history[t] = await mentions(t); if (history[t].length >= 4) fc[t] = forecast(history[t]); }
  const data = { updated: new Date().toISOString(), history, forecast: fc, releases: await releases(), repos: await repos() };
  data.analysis = await analyze({ forecast: fc, repos: data.repos });
  ins = data; fs.writeFileSync(dataFile('insights.json'), JSON.stringify(ins)); console.log('insights built');
}
module.exports = (app, companies = []) => {
  let arch = J(dataFile('archive.json'), {});
  global.techArchive = arch;
  // Every headline ever collected is archived => searchable history.
  global.onRefresh = c => {
    Object.values(c).flat().forEach(i => { if (!arch[i.link]) arch[i.link] = i; });
    const k = Object.keys(arch).sort((a, b) => arch[a].date - arch[b].date);
    if (k.length > 5000) k.slice(0, k.length - 5000).forEach(x => delete arch[x]);
    global.techArchive = arch;
    fs.writeFileSync(dataFile('archive.json'), JSON.stringify(arch));
  };
  app.get('/api/insights', (q, r) => r.json(ins || { building: true }));
  app.get('/api/archive', (q, r) => {
    const search = String(q.query.q || '').trim().toLowerCase().slice(0, 100), topic = q.query.topic;
    r.json(Object.values(arch).filter(item =>
      (!topic || item.topic === topic) &&
      (!search || `${item.title || ''} ${item.summary || ''} ${item.source || ''} ${item.topic || ''}`.toLowerCase().includes(search)),
    ).sort((a, b) => b.date - a.date).slice(0, 100));
  });
  app.get('/api/search', (q, r) => {
    const search = String(q.query.q || '').trim().toLowerCase().slice(0, 100);
    if (search.length < 2) return r.json({ query: search, companies: [], articles: [] });
    const seen = new Set();
    const articles = [...Object.values(arch), ...(global.techSocialArticles || [])].filter(item => {
      const key = item.link || `${item.topic}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const matchingCompanies = companies.filter(company =>
      `${company.name} ${company.country} ${(company.sectors || []).join(' ')} ${company.description || ''}`.toLowerCase().includes(search),
    ).slice(0, 8);
    const matchingArticles = articles.filter(item =>
      `${item.title || ''} ${item.summary || ''} ${item.source || ''} ${item.topic || ''}`.toLowerCase().includes(search),
    ).sort((a, b) => b.date - a.date).slice(0, 12);
    return r.json({ query: search, companies: matchingCompanies, articles: matchingArticles });
  });
  if (!ins || Date.now() - new Date(ins.updated) > 864e5) build();
  cron.schedule('0 3 * * *', build);
};
