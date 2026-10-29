import { useCallback, useEffect, useMemo, useState } from "react";

const periods = ["1H", "24H", "7D", "1Y"];
const topicInfo = {
  ai: { category: "Artificial intelligence", tag: "AI & models", accent: "violet" },
  languages: { category: "Programming", tag: "Programming languages", accent: "blue" },
  business: { category: "Markets & business", tag: "Business & funding", accent: "green" },
  security: { category: "Cybersecurity", tag: "Cybersecurity", accent: "orange" },
  hardware: { category: "Hardware", tag: "Hardware & semiconductors", accent: "blue" },
  cloud: { category: "Cloud computing", tag: "Cloud & data centers", accent: "violet" },
  ethiopia: { category: "Ethiopia tech", tag: "Ethiopia technology", accent: "orange" },
  companies: { category: "Company updates", tag: "Company updates", accent: "green" },
  youtube: { category: "Video updates", tag: "YouTube", accent: "orange" },
  telegram: { category: "Social updates", tag: "Telegram", accent: "blue" },
  tiktok: { category: "Video updates", tag: "TikTok", accent: "violet" },
  websites: { category: "Websites", tag: "Technology websites", accent: "green" },
};

const languageGuides = [
  {
    name: "Python",
    detail: "AI · data · automation",
    reason:
      "Python is popular because its readable syntax and extensive libraries let people move quickly from an idea to a working program. It is especially useful in data science, machine learning, scripting, and education. Its trade-offs include slower execution than compiled languages for some workloads and the need to manage dependencies carefully.",
    sourceTerm: "Python",
  },
  {
    name: "TypeScript",
    detail: "Web · apps · large teams",
    reason:
      "TypeScript adds static type checking to JavaScript. Types can catch many mistakes while code is being written, which helps teams maintain large web applications. It still runs as JavaScript after compilation, so developers can use the broad web ecosystem.",
    sourceTerm: "TypeScript",
  },
  {
    name: "Rust",
    detail: "Systems · performance · security",
    reason:
      "Rust is chosen when performance and memory safety matter, including systems software, developer tools, and infrastructure. Its compiler checks memory use without a garbage collector; the learning curve can be steeper than in scripting languages.",
    sourceTerm: "Rust",
  },
  {
    name: "Kotlin",
    detail: "Android · server applications",
    reason:
      "Kotlin is widely used in Android development and works with the Java ecosystem. Concise syntax and null-safety features help reduce common errors, while Java interoperability makes gradual adoption practical for existing teams.",
    sourceTerm: "Kotlin",
  },
];

const topicExplanations = {
  ai: {
    why:
      "AI model and product changes can affect software workflows, data-center demand, research priorities, and how organizations handle privacy and safety.",
    watch:
      "Look for the original research or product announcement, model evaluations, licensing terms, hardware requirements, and independent testing.",
  },
  languages: {
    why:
      "Language releases and ecosystem changes matter because they can affect application security, performance, compatibility, and the tools developers rely on.",
    watch:
      "Check the official release notes for breaking changes, security fixes, support dates, and migration guidance before upgrading production systems.",
  },
  business: {
    why:
      "Funding, company strategy, and competition can signal where organizations are investing, but a headline alone does not establish a company's financial health or future performance.",
    watch:
      "Separate reported facts from forecasts. For investing decisions, consult official filings and current, licensed market data; this news feed is not a quote service.",
  },
  ethiopia: {
    why:
      "Local technology coverage can reveal how connectivity, digital payments, policy, and startup activity affect people and businesses in Ethiopia.",
    watch:
      "Confirm the date and details with the organization or official source named in the report, especially for policy, service availability, and financial products.",
  },
  security: {
    why:
      "Security advisories can affect whether software and online services remain safe to use. Timely patches matter because attackers may target known weaknesses after they become public.",
    watch:
      "Verify affected products and versions against the vendor's official advisory. Prioritize updates based on exposure and the vendor's severity guidance.",
  },
  hardware: {
    why:
      "Chip and device developments influence the cost, performance, and availability of computers, phones, and the infrastructure used to train and run software.",
    watch:
      "Distinguish announced products from products that are shipping. Compare independent benchmarks, availability, power use, and the full system cost.",
  },
  cloud: {
    why:
      "Cloud platforms and data centers provide the computing and storage behind many apps, business systems, and AI services. Changes can affect reliability, costs, and energy demand.",
    watch:
      "Look for published service status, pricing, regions, capacity, and independent reliability information rather than relying on promotional claims alone.",
  },
  companies: {
    why:
      "Company coverage can help explain product launches, partnerships, hiring, investment, and competition. A news article is a report, not a verified account of current operations.",
    watch:
      "Check the company's own announcement, official product status page, regulatory notices, and dated filings before treating a reported change as current fact.",
  },
  youtube: {
    why:
      "A publisher or developer video can add demonstrations and technical context that a short headline leaves out.",
    watch:
      "Check the channel, upload date, sponsorship disclosure, and linked documentation. A video feed lists uploads; it does not independently verify their claims.",
  },
  telegram: {
    why:
      "A monitored public channel can surface time-sensitive announcements and local community updates.",
    watch:
      "Confirm the channel identity and compare important claims with an official company, government, or project source.",
  },
  tiktok: {
    why:
      "Short-form video can surface product announcements and public discussion quickly, but clips often omit technical and business context.",
    watch:
      "Verify the creator and date, and look for the original announcement or documentation. This feed only uses administrator-configured authorized sources.",
  },
  websites: {
    why:
      "Publisher and project websites provide original announcements, release notes, and technical documentation.",
    watch:
      "Prefer dated primary sources and compare them with independent reporting when evaluating consequential claims.",
  },
};

const periodLabels = {
  "1H": "news collected in the last hour",
  "24H": "news collected in the last 24 hours",
  "7D": "news collected in the last 7 days",
  "1Y": "yearly Python mentions in Hacker News stories",
};

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value) : "—";
}

function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? "" : "s"} ago`;
}

function getSourceUrl(link) {
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function makeArticleSeries(stories, period, now) {
  const duration = period === "1H" ? 60 * 60_000 : period === "24H" ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000;
  const bucketCount = period === "7D" ? 7 : 12;
  const bucketDuration = duration / bucketCount;
  const values = Array(bucketCount).fill(0);
  for (const story of stories) {
    const age = now - Number(story.date);
    if (Number.isFinite(age) && age >= 0 && age < duration) {
      const index = Math.min(bucketCount - 1, Math.floor((duration - age) / bucketDuration));
      values[index] += 1;
    }
  }
  return values;
}

function TrendChart({ values, label }) {
  const maximum = Math.max(...values, 0);
  const points = values.length > 1
    ? values.map((value, index) => `${(index / (values.length - 1)) * 600},${155 - (maximum ? value / maximum : 0) * 125}`).join(" ")
    : "";
  const area = points ? `0,160 ${points} 600,160` : "";

  return (
    <svg
      className="trend-chart"
      viewBox="0 0 600 180"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8067f6" stopOpacity=".24" />
          <stop offset="100%" stopColor="#8067f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[35, 75, 115, 155].map((y) => (
        <line key={y} x1="0" x2="600" y1={y} y2={y} className="chart-grid" />
      ))}
      {points && <polygon points={area} fill="url(#chart-fill)" />}
      {points && <polyline points={points} className="chart-line" />}
      {points && <circle cx="600" cy={155 - (maximum ? values[values.length - 1] / maximum : 0) * 125} r="4.5" className="chart-dot" />}
    </svg>
  );
}

function App() {
  const [period, setPeriod] = useState("24H");
  const [activeSection, setActiveSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("All topics");
  const [storyLimit, setStoryLimit] = useState(10);
  const [searchResults, setSearchResults] = useState({ companies: [], articles: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [companyList, setCompanyList] = useState([]);
  const [sourceStatuses, setSourceStatuses] = useState([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyCountry, setCompanyCountry] = useState("All countries");
  const [companySector, setCompanySector] = useState("All sectors");
  const [feed, setFeed] = useState([]);
  const [topics, setTopics] = useState({});
  const [insights, setInsights] = useState(null);
  const [apiErrors, setApiErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [now, setNow] = useState(Date.now());
  const dateLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const loadData = useCallback(async () => {
    const endpoints = [
      ["/api/feed", async () => {
        const response = await fetch("/api/feed");
        if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("News feed returned an unexpected response");
        setFeed(data);
      }],
      ["/api/topics", async () => {
        const response = await fetch("/api/topics");
        if (!response.ok) throw new Error(`Topic list returned HTTP ${response.status}`);
        setTopics(await response.json());
      }],
      ["/api/insights", async () => {
        const response = await fetch("/api/insights");
        if (!response.ok) throw new Error(`Research insights returned HTTP ${response.status}`);
        const data = await response.json();
        if (!data.building) setInsights(data);
      }],
      ["/api/companies", async () => {
        const response = await fetch("/api/companies");
        if (!response.ok) throw new Error(`Company directory returned HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.companies)) throw new Error("Company directory returned an unexpected response");
        setCompanyList(data.companies);
      }],
      ["/api/sources", async () => {
        const response = await fetch("/api/sources");
        if (!response.ok) throw new Error(`Source status returned HTTP ${response.status}`);
        const data = await response.json();
        setSourceStatuses(data.sources || []);
      }],
    ];
    const results = await Promise.allSettled(endpoints.map(([, request]) => request()));
    setApiErrors(results.flatMap((result, index) =>
      result.status === "rejected" ? [`${endpoints[index][0]}: ${result.reason.message}`] : [],
    ));
    setLastFetched(Date.now());
    setNow(Date.now());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = window.setInterval(loadData, 5 * 60_000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setSearchResults({ companies: [], articles: [] });
      setSearchLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search returned HTTP ${response.status}`);
        setSearchResults(await response.json());
      } catch (error) {
        if (error.name !== "AbortError") {
          setSearchResults({ companies: [], articles: [] });
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const stories = useMemo(() => feed.map((item) => {
    const topic = topicInfo[item.topic] || {
      category: item.topic || "Technology",
      tag: "Technology",
      accent: "violet",
    };
    return {
      ...item,
      ...topic,
      time: formatRelativeTime(item.date),
      sourceUrl: getSourceUrl(item.link),
      explanation: topicExplanations[item.topic] || {
        why: "Technology changes can influence how people work, communicate, and access digital services.",
        watch: "Open the original report and check its publication date, named sources, and supporting evidence.",
      },
    };
  }), [feed, now]);

  const filteredStories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return stories.filter((story) => {
      const matchesTopic =
        selectedTopic === "All topics" || story.category === selectedTopic;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        `${story.title} ${story.summary} ${story.category} ${story.tag}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesTopic && matchesSearch;
    });
  }, [query, selectedTopic, stories]);
  const visibleStories = filteredStories.slice(0, storyLimit);

  const annualHistory = insights?.history?.Python || [];
  const annualValues = annualHistory.slice(-12).map((entry) => entry[1]);
  const yearlyDataAvailable = annualValues.length > 1;
  const chartValues = period === "1Y" && yearlyDataAvailable
    ? annualValues
    : makeArticleSeries(feed, period, now);
  const chartTitle = period === "1Y" && yearlyDataAvailable
    ? "Python mentions in Hacker News stories"
    : "Technology headlines collected by the feed";
  const chartLabel = period === "1Y" && yearlyDataAvailable
    ? "Annual Python mentions in Hacker News stories"
    : `Collected technology headlines over ${period}`;
  const periodCount = period === "1Y" && yearlyDataAvailable
    ? annualValues[annualValues.length - 1]
    : chartValues.reduce((sum, value) => sum + value, 0);
  const chartCountLabel = period === "1Y" && yearlyDataAvailable
    ? "estimated annual mentions"
    : period === "1Y"
      ? "headlines in the available 7-day feed cache · annual data unavailable"
      : periodLabels[period];
  const totalStars = insights?.repos?.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const languageMentions = (term) => insights?.history?.[term]?.at(-1)?.[1];
  const companyCountries = [...new Set(companyList.map((company) => company.country))].sort();
  const companySectors = [...new Set(companyList.flatMap((company) => company.sectors))].sort();
  const visibleCompanies = companyList.filter((company) =>
    (companyCountry === "All countries" || company.country === companyCountry) &&
    (companySector === "All sectors" || company.sectors.includes(companySector)) &&
    (!companyQuery || `${company.name} ${company.country} ${company.sectors.join(" ")} ${company.description}`.toLowerCase().includes(companyQuery.toLowerCase())),
  );

  const navigation = [
    { id: "overview", label: "Overview", icon: "◫" },
    { id: "business", label: "Business & markets", icon: "↗" },
    { id: "programming", label: "Programming", icon: "⌘" },
    { id: "ai-research", label: "AI & research", icon: "✳" },
    { id: "security", label: "Cybersecurity", icon: "⬡" },
    { id: "companies", label: "Company directory", icon: "▦" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        :root { font-family: 'DM Sans', sans-serif; color: #202137; background: #f7f8fc; font-synthesis: none; }
        * { box-sizing: border-box; }
        body { margin: 0; min-width: 320px; }
        button, input { font: inherit; }
        button { cursor: pointer; }
        .app-shell { min-height: 100vh; }
        .sidebar { position: fixed; inset: 0 auto 0 0; z-index: 3; display: flex; width: 246px; flex-direction: column; padding: 27px 17px 18px; color: #a6a6ba; background: #171728; }
        .brand { display: flex; align-items: center; gap: 11px; padding: 0 9px 35px; color: #fff; font: 800 17px 'Manrope', sans-serif; letter-spacing: -.5px; }
        .brand-mark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 11px; color: #fff; background: linear-gradient(140deg, #a288ff, #6752df); font-size: 19px; }
        .workspace-label { padding: 0 11px 11px; color: #72728b; font-size: 10px; font-weight: 700; letter-spacing: 1.25px; text-transform: uppercase; }
        .nav-list { display: grid; gap: 5px; }
        .nav-item { display: flex; width: 100%; align-items: center; gap: 12px; border: 0; border-radius: 9px; padding: 11px 12px; color: #a6a6ba; background: transparent; text-align: left; font-size: 12px; transition: .18s ease; }
        .nav-item:hover { color: #fff; background: #25253a; }
        .nav-item.active { color: #fff; background: #302d4d; box-shadow: inset 3px 0 #9c84ff; }
        .nav-icon { display: grid; width: 18px; place-items: center; color: #b6a6ff; font-size: 17px; }
        .sidebar-bottom { margin-top: auto; }
        .upgrade-card { margin: 0 3px 18px; border: 1px solid #34334a; border-radius: 12px; padding: 14px; background: linear-gradient(145deg, #25243b, #1d1d30); }
        .upgrade-card strong { display: block; margin: 0 0 6px; color: #f4f1ff; font-size: 12px; }
        .upgrade-card p { margin: 0 0 12px; color: #a09fb4; font-size: 10px; line-height: 1.55; }
        .upgrade-card button { border: 0; border-radius: 7px; padding: 8px 10px; color: #fff; background: #705ce4; font-size: 10px; font-weight: 700; }
        .profile { display: flex; align-items: center; gap: 10px; border-top: 1px solid #2b2b3d; padding: 17px 5px 0; }
        .avatar { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 50%; color: #f1eaff; background: #51416c; font-size: 11px; font-weight: 700; }
        .profile strong { display: block; color: #e7e6f0; font-size: 11px; }
        .profile span { color: #85849a; font-size: 10px; }
        .main { min-height: 100vh; margin-left: 246px; padding: 0 42px 50px; }
        .topbar { display: flex; min-height: 77px; align-items: center; justify-content: space-between; border-bottom: 1px solid #eaebf1; }
        .breadcrumb { color: #9a9bab; font-size: 11px; }
        .breadcrumb strong { color: #424356; font-weight: 600; }
        .top-actions { display: flex; align-items: center; gap: 13px; }
        .top-actions { position: relative; }
        .search-box { display: flex; width: 230px; align-items: center; gap: 8px; border: 1px solid #e8e9f0; border-radius: 8px; padding: 9px 11px; color: #999bad; background: #fff; }
        .search-box input { width: 100%; border: 0; outline: 0; color: #303146; background: transparent; font-size: 11px; }
        .search-box input::placeholder { color: #a7a8b7; }
        .search-results { position: absolute; top: 43px; right: 46px; z-index: 8; width: min(440px, calc(100vw - 90px)); max-height: 65vh; overflow-y: auto; border: 1px solid #e8e9f0; border-radius: 10px; padding: 8px; background: #fff; box-shadow: 0 12px 35px #25234620; }
        .search-results-title { padding: 7px 8px 5px; color: #9293a2; font-size: 9px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
        .search-result { display: block; width: 100%; border: 0; border-radius: 7px; padding: 8px; color: #45465a; background: transparent; text-align: left; text-decoration: none; }
        .search-result:hover { background: #f5f3ff; }
        .search-result strong { display: block; color: #37384c; font-size: 10px; line-height: 1.45; }
        .search-result span { display: block; margin-top: 3px; color: #9293a2; font-size: 8px; }
        .search-empty { padding: 12px 8px; color: #9293a2; font-size: 9px; line-height: 1.5; }
        .directory-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .directory-controls input, .directory-controls select { min-width: 0; max-width: 100%; border: 1px solid #e8e9f0; border-radius: 8px; padding: 9px 10px; color: #56576a; background: #fff; font-size: 10px; }
        .company-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; }
        .company-card { min-width: 0; border: 1px solid #ececf2; border-radius: 10px; padding: 13px; background: #fff; }
        .company-card h3 { margin: 0 0 3px; color: #323348; font: 700 12px 'Manrope', sans-serif; }
        .company-country { color: #9293a2; font-size: 9px; }
        .company-card > p { margin: 9px 0; color: #77788b; font-size: 9px; line-height: 1.55; }
        .company-sector-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .company-sector { border-radius: 12px; padding: 4px 6px; color: #6b58cc; background: #f2efff; font-size: 8px; }
        .company-status { margin-top: 9px; border-left: 2px solid #edc979; padding-left: 7px; color: #82724c; font-size: 8px; line-height: 1.5; }
        .company-links { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 10px; }
        .company-links a { color: #705dd7; font-size: 9px; font-weight: 700; text-decoration: none; }
        .company-coverage { margin-top: 9px; border-top: 1px solid #f0f0f4; padding-top: 8px; }
        .company-coverage strong { display: block; margin-bottom: 5px; color: #76778a; font-size: 8px; }
        .company-coverage a { display: block; margin-top: 4px; color: #56576a; font-size: 8px; line-height: 1.45; text-decoration: none; }
        .company-coverage a:hover { color: #6956d3; text-decoration: underline; }
        .icon-button { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #e8e9f0; border-radius: 8px; color: #65667a; background: #fff; font-size: 15px; }
        .page-content { max-width: 1250px; margin: 0 auto; }
        .page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 28px 0 20px; }
        .eyebrow { margin-bottom: 7px; color: #89899b; font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
        h1, h2, h3, p { margin-top: 0; }
        h1 { margin-bottom: 6px; color: #202137; font: 800 26px 'Manrope', sans-serif; letter-spacing: -.9px; }
        .heading-subtitle { margin: 0; color: #898a9d; font-size: 12px; }
        .period-switch { display: flex; gap: 3px; border: 1px solid #e7e8ef; border-radius: 9px; padding: 4px; background: #fff; }
        .period-switch button { min-width: 39px; border: 0; border-radius: 6px; padding: 7px 9px; color: #898a9d; background: transparent; font-size: 10px; font-weight: 700; }
        .period-switch button.selected { color: #fff; background: #7562df; box-shadow: 0 2px 6px #7562df40; }
        .demo-note { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; border: 1px solid #eee9ff; border-radius: 8px; padding: 10px 13px; color: #76728a; background: #f4f1ff; font-size: 10px; }
        .demo-note b { color: #6654c5; }
        .demo-note > span:nth-child(2) { flex: 1; line-height: 1.55; }
        .refresh-button { flex: 0 0 auto; }
        .refresh-button:disabled { cursor: wait; opacity: .55; }
        .api-error { margin: -7px 0 14px; border: 1px solid #f1d2d2; border-radius: 8px; padding: 10px 12px; color: #934e53; background: #fff7f7; font-size: 10px; line-height: 1.6; }
        .api-error code { color: #743b42; font-weight: 700; }
        .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #8d78ee; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .metric-card, .panel { border: 1px solid #ececf2; border-radius: 11px; background: #fff; box-shadow: 0 2px 6px #25234605; }
        .metric-card { min-height: 116px; padding: 15px 16px; }
        .metric-top { display: flex; align-items: center; justify-content: space-between; color: #85869a; font-size: 10px; }
        .metric-icon { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 8px; color: #7461da; background: #f0edff; font-size: 13px; }
        .metric-value { margin: 11px 0 4px; color: #25263c; font: 800 23px 'Manrope', sans-serif; letter-spacing: -.7px; }
        .metric-foot { color: #8c8d9d; font-size: 9px; }
        .positive { color: #2da47b; font-weight: 700; }
        .negative { color: #df696e; font-weight: 700; }
        .content-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(270px, .95fr); gap: 15px; margin-top: 15px; }
        .panel { padding: 17px 18px; }
        .panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .panel-heading h2 { margin: 0 0 4px; color: #2a2b40; font: 700 13px 'Manrope', sans-serif; }
        .panel-heading p { margin: 0; color: #999aaa; font-size: 9px; }
        .text-link { border: 0; padding: 2px 0; color: #7562df; background: none; font-size: 10px; font-weight: 700; }
        .chart-summary { display: flex; align-items: baseline; gap: 10px; margin-top: 18px; }
        .chart-summary strong { color: #292a40; font: 800 27px 'Manrope', sans-serif; letter-spacing: -.8px; }
        .chart-summary span { color: #2da47b; font-size: 10px; font-weight: 700; }
        .chart-container { height: 147px; margin: 8px 0 0; }
        .trend-chart { width: 100%; height: 100%; overflow: visible; }
        .chart-grid { stroke: #f0f0f5; stroke-dasharray: 4 5; stroke-width: 1; }
        .chart-line { fill: none; stroke: #8067f6; stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
        .chart-dot { fill: #fff; stroke: #8067f6; stroke-width: 3; }
        .chart-labels { display: flex; justify-content: space-between; color: #aaaaba; font-size: 9px; }
        .market-list { display: grid; margin-top: 12px; }
        .market-row { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f0f4; padding: 11px 0; }
        .market-row:last-child { border-bottom: 0; }
        .market-row .market-name { min-width: 0; flex: 1; }
        .market-row .market-name strong { line-height: 1.45; }
        .market-disclaimer { margin: 5px 0 0; color: #9899a8; font-size: 9px; line-height: 1.55; }
        .repository-stars { flex: 0 0 auto; color: #6d5bd0; font-size: 10px; }
        .market-name { display: flex; align-items: center; gap: 9px; }
        .market-badge { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 8px; color: #7060ca; background: #f1efff; font-size: 9px; font-weight: 800; }
        .market-name strong { display: block; color: #38394d; font-size: 10px; }
        .market-name span { display: block; margin-top: 3px; color: #a0a1af; font-size: 8px; }
        .market-change { font-size: 10px; font-weight: 700; }
        .section-block { margin-top: 22px; scroll-margin-top: 18px; }
        .section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; }
        .section-title h2 { margin: 0; color: #27283d; font: 700 15px 'Manrope', sans-serif; letter-spacing: -.25px; }
        .section-title span { color: #9a9baa; font-size: 9px; }
        .lower-grid { display: grid; grid-template-columns: minmax(250px, .85fr) minmax(0, 1.6fr); gap: 15px; }
        .language-list { display: grid; gap: 14px; margin-top: 17px; }
        .language-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .language-head strong { color: #424357; font-size: 10px; }
        .language-head span { color: #a0a1ae; font-size: 8px; }
        .language-list > div { border-bottom: 1px solid #f1f1f5; padding-bottom: 10px; }
        .language-list > div:last-child { border-bottom: 0; padding-bottom: 0; }
        .explanation-copy { margin: 7px 0 0; color: #747588; font-size: 9px; line-height: 1.65; }
        .source-note { margin: 12px 0 0; color: #999aaa; font-size: 9px; line-height: 1.6; }
        .chart-caveat { margin: 8px 0 0; color: #999aaa; font-size: 9px; line-height: 1.55; }
        .release-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 15px; }
        .release-item { border: 1px solid #f0f0f5; border-radius: 8px; padding: 9px; }
        .release-item strong { display: block; margin-bottom: 5px; color: #45465a; font-size: 10px; text-transform: capitalize; }
        .release-item span { color: #8d8e9e; font-size: 8px; line-height: 1.5; }
        .source-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
        .source-strip > div { border: 1px solid #ececf2; border-radius: 9px; padding: 12px; background: #fff; }
        .source-strip strong { display: block; margin-bottom: 5px; color: #424357; font-size: 10px; }
        .source-strip span { display: block; color: #9293a2; font-size: 9px; line-height: 1.5; }
        .source-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
        .source-status { display: flex; align-items: flex-start; gap: 9px; border: 1px solid #ececf2; border-radius: 9px; padding: 10px; background: #fff; }
        .source-status-dot { flex: 0 0 auto; width: 7px; height: 7px; margin-top: 3px; border-radius: 50%; background: #d3a548; }
        .source-status-dot.configured { background: #40aa82; }
        .source-status strong { display: block; margin-bottom: 3px; color: #45465a; font-size: 9px; }
        .source-status span:not(.source-status-dot) { display: block; color: #9293a2; font-size: 8px; line-height: 1.5; }
        .bar-track { height: 5px; overflow: hidden; border-radius: 9px; background: #f0f0f5; }
        .bar-fill { height: 100%; border-radius: inherit; }
        .story-filters { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 14px; }
        .filter-chip { border: 1px solid #ececf2; border-radius: 20px; padding: 6px 9px; color: #858698; background: #fff; font-size: 8px; }
        .filter-chip.active { border-color: #e2ddff; color: #6956d3; background: #f4f1ff; }
        .story-list { display: grid; }
        .story { display: grid; grid-template-columns: 3px minmax(0, 1fr); gap: 12px; border-bottom: 1px solid #f0f0f4; padding: 13px 0; }
        .story:last-child { border: 0; padding-bottom: 0; }
        .story-accent { border-radius: 4px; background: #9276ff; }
        .story-accent.blue { background: #58a6ff; }
        .story-accent.green { background: #55b693; }
        .story-accent.orange { background: #ff906b; }
        .story-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; color: #9d9eae; font-size: 8px; }
        .story-tag { color: #7460d8; font-weight: 700; }
        .story h3 { margin: 0 0 8px; color: #35364b; font: 700 11px 'Manrope', sans-serif; line-height: 1.45; }
        .story h3 a { color: inherit; text-decoration: none; }
        .story h3 a:hover { color: #6956d3; text-decoration: underline; }
        .story-source-summary { margin: 0 0 8px; color: #77788b; font-size: 9px; line-height: 1.55; }
        .story-source-summary strong { display: block; margin-bottom: 3px; color: #68697d; font-size: 9px; }
        .story-explainer { margin-top: 6px; }
        .story-explainer strong { color: #68697d; font-size: 9px; }
        .story-explainer p { margin: 3px 0 0; color: #8e8f9f; font-size: 9px; line-height: 1.55; }
        .empty-state { padding: 30px 0; color: #999aaa; text-align: center; font-size: 10px; }
        .footer { margin-top: 25px; color: #a4a5b2; text-align: center; font-size: 9px; }
        @media (max-width: 1050px) { .main { padding-right: 25px; padding-left: 25px; } .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .source-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .source-status-grid { grid-template-columns: 1fr; } }
        @media (max-width: 1050px) { .company-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) { .sidebar { width: 64px; align-items: center; padding: 19px 8px 13px; } .brand { padding: 0 0 27px; } .brand-name, .workspace-label, .nav-label, .upgrade-card, .profile-info { display: none; } .nav-list { width: 100%; } .nav-item { justify-content: center; padding: 11px 0; } .nav-icon { font-size: 18px; } .profile { justify-content: center; width: 100%; padding: 14px 0 0; } .main { margin-left: 64px; padding: 0 17px 35px; } .topbar { min-height: 65px; } .search-box { width: 170px; } .content-grid, .lower-grid { grid-template-columns: 1fr; } }
        @media (max-width: 480px) { .main { padding-right: 12px; padding-left: 12px; } .breadcrumb { display: none; } .topbar { justify-content: flex-end; } .search-box { width: min(52vw, 190px); } .page-heading { align-items: flex-start; flex-direction: column; padding-top: 22px; } h1 { font-size: 23px; } .metric-grid { gap: 9px; } .metric-card { min-height: 105px; padding: 12px; } .metric-value { font-size: 20px; } .panel { padding: 14px; } .demo-note { align-items: flex-start; flex-wrap: wrap; } .release-grid { grid-template-columns: 1fr; } .source-strip { grid-template-columns: 1fr; } .company-grid { grid-template-columns: 1fr; } .directory-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .directory-controls input { grid-column: 1 / -1; } .market-row .market-name strong { font-size: 9px; } }
      `}</style>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">✳</span>
            <span className="brand-name">Signal<span style={{ color: "#a995ff" }}>Tech</span></span>
          </div>
          <div className="workspace-label">Workspace</div>
          <nav className="nav-list" aria-label="Main navigation">
            {navigation.map((item) => (
              <button
                className={`nav-item${activeSection === item.id ? " active" : ""}`}
                key={item.id}
                aria-label={item.label}
                onClick={() => {
                  setActiveSection(item.id);
                  if (item.id === "ai-research") setSelectedTopic("Artificial intelligence");
                  if (item.id === "security") setSelectedTopic("Cybersecurity");
                  document.getElementById(item.id === "ai-research" || item.id === "security" ? "latest" : item.id)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="upgrade-card">
              <strong>Your technology briefing</strong>
              <p>Explore the signals shaping the world of technology.</p>
              <button onClick={() => document.getElementById("latest")?.scrollIntoView({ behavior: "smooth" })}>
                Explore today's brief
              </button>
            </div>
            <div className="profile">
              <div className="avatar">GU</div>
              <div className="profile-info">
                <strong>Guest reader</strong>
                <span>Personal dashboard</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main" id="overview">
          <header className="topbar">
            <div className="breadcrumb">Workspace <span> / </span> <strong>Technology overview</strong></div>
            <div className="top-actions">
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Search technology news..."
                  aria-label="Search technology news"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setStoryLimit(10);
                  }}
                />
              </label>
              {query.trim().length >= 2 && (
                <div className="search-results" role="listbox" aria-label="Search all companies and archived news">
                  <div className="search-results-title">Companies</div>
                  {searchLoading && <div className="search-empty">Searching company profiles and archived headlines…</div>}
                  {!searchLoading && searchResults.companies.length === 0 && <div className="search-empty">No company profile matches yet.</div>}
                  {searchResults.companies.map((company) => (
                    <button className="search-result" key={company.id} onClick={() => {
                      setCompanyQuery(query.trim());
                      document.getElementById("companies")?.scrollIntoView({ behavior: "smooth" });
                    }}>
                      <strong>{company.name}</strong><span>{company.country} · {company.sectors.join(", ")}</span>
                    </button>
                  ))}
                  <div className="search-results-title">Archived headlines</div>
                  {!searchLoading && searchResults.articles.length === 0 && <div className="search-empty">No matching archived headlines.</div>}
                  {searchResults.articles.map((article, index) => {
                    const sourceUrl = getSourceUrl(article.link);
                    return sourceUrl ? (
                      <a className="search-result" href={sourceUrl} target="_blank" rel="noreferrer" key={article.link || `${article.title}-${index}`}>
                        <strong>{article.title}</strong><span>{article.source || article.topic || "Technology news"} · {formatRelativeTime(article.date)}</span>
                      </a>
                    ) : (
                      <div className="search-result" key={`${article.title}-${index}`}><strong>{article.title}</strong><span>{article.source || article.topic || "Technology news"}</span></div>
                    );
                  })}
                  {!searchLoading && searchResults.companies.length === 0 && searchResults.articles.length === 0 && <div className="search-empty">Try a company, product, country, programming language, or topic.</div>}
                </div>
              )}
              <button className="icon-button" aria-label="Notifications">♧</button>
            </div>
          </header>

          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">{dateLabel} <span>·</span> Tech intelligence</div>
                <h1>Technology, in focus.</h1>
                <p className="heading-subtitle">A clear view of the ideas, industries, and people moving tech forward.</p>
              </div>
              <div className="period-switch" aria-label="Select reporting period">
                {periods.map((item) => (
                  <button
                    className={period === item ? "selected" : ""}
                    key={item}
                    onClick={() => setPeriod(item)}
                    aria-pressed={period === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="demo-note">
              <span className="pulse-dot" />
              <span>
                <b>{isLoading ? "Connecting to live sources" : apiErrors.length ? "Some data sources are unavailable" : "Live sources connected"}</b>
                {" "}Google News, Hacker News, GitHub, and software release data. Headlines refresh from the local API; not every source updates at the same time.
                {lastFetched && <span> Last checked {new Date(lastFetched).toLocaleTimeString()}.</span>}
              </span>
              <button className="text-link refresh-button" onClick={loadData} disabled={isLoading}>Refresh data</button>
            </div>
            {apiErrors.length > 0 && (
              <div className="api-error" role="status">
                Live data could not be fully loaded: {apiErrors.join(" · ")}. Start the TechPulse backend in another terminal with <code>npm start</code>, then refresh.
              </div>
            )}

            <section className="metric-grid" aria-label="Technology overview metrics">
              <article className="metric-card">
                <div className="metric-top"><span>Headlines collected</span><span className="metric-icon">✳</span></div>
                <div className="metric-value">{isLoading ? "…" : formatNumber(feed.length)}</div>
                <div className="metric-foot">From connected news feeds</div>
              </article>
              <article className="metric-card">
                <div className="metric-top"><span>Topics covered</span><span className="metric-icon">◉</span></div>
                <div className="metric-value">{Object.keys(topics).length || "—"}</div>
                <div className="metric-foot">AI, software, business, security, cloud & more</div>
              </article>
              <article className="metric-card">
                <div className="metric-top"><span>Open-source stars</span><span className="metric-icon">⌘</span></div>
                <div className="metric-value">{totalStars === undefined ? "—" : formatNumber(totalStars)}</div>
                <div className="metric-foot">Combined stars for tracked GitHub projects</div>
              </article>
              <article className="metric-card">
                <div className="metric-top"><span>Research data updated</span><span className="metric-icon">◷</span></div>
                <div className="metric-value" style={{ fontSize: 17 }}>{insights?.updated ? new Date(insights.updated).toLocaleDateString() : "—"}</div>
                <div className="metric-foot">Historical discussions, releases & repositories</div>
              </article>
            </section>

            <div className="content-grid">
              <section className="panel" aria-labelledby="activity-title">
                <div className="panel-heading">
                  <div><h2 id="activity-title">{chartTitle}</h2><p>Source: {period === "1Y" && yearlyDataAvailable ? "Hacker News Algolia search API" : "articles gathered by the TechPulse RSS feeds"}</p></div>
                  <span className="text-link">{period}</span>
                </div>
                <div className="chart-summary"><strong>{formatNumber(periodCount)}</strong><span style={{ color: "#999aaa", fontWeight: 400 }}>{chartCountLabel}</span></div>
                <div className="chart-container"><TrendChart values={chartValues} label={chartLabel} /></div>
                <div className="chart-labels"><span>{period === "1Y" && yearlyDataAvailable ? annualHistory.slice(-12)[0][0] : period === "1H" ? "60 min ago" : period === "24H" ? "24 hr ago" : "7 days ago"}</span><span>{period === "1Y" && yearlyDataAvailable ? annualHistory.at(-1)[0] : period === "7D" ? "Daily collection" : "Recent"}</span><span>{period === "1Y" && yearlyDataAvailable ? "Now · annualized" : "Now"}</span></div>
                {period === "1Y" && yearlyDataAvailable && <p className="chart-caveat">Hacker News story mentions are a discussion signal, not a measure of all developers or language usage. The current year is annualized by the backend.</p>}
                {period !== "1Y" && chartValues.every((value) => value === 0) && <p className="chart-caveat">No matching headlines were collected in this window. This does not mean there was no technology activity.</p>}
              </section>

              <section className="panel" id="business" aria-labelledby="markets-title">
                <div className="panel-heading">
                  <div><h2 id="markets-title">Technology business watch</h2><p>Live funding and competition headlines · not stock quotes</p></div>
                  <span className="text-link">{stories.filter((story) => story.topic === "business").length} stories</span>
                </div>
                <p className="explanation-copy">Follow investment, company strategy, and competition through reporting. News headlines can provide context, but they are not real-time financial data and should not be used alone to make trading decisions.</p>
                <div className="market-list">
                  {stories.filter((story) => story.topic === "business").slice(0, 3).map((story) => (
                    <div className="market-row" key={story.link || story.title}>
                      <div className="market-name">
                        <div className="market-badge">BIZ</div>
                        <div><strong>{story.title}</strong><span>{story.time} · {story.sourceUrl ? new URL(story.sourceUrl).hostname : "News source"}</span></div>
                      </div>
                      {story.sourceUrl && <a className="text-link" href={story.sourceUrl} target="_blank" rel="noreferrer">Read ↗</a>}
                    </div>
                  ))}
                  {!stories.some((story) => story.topic === "business") && <div className="empty-state">{isLoading ? "Loading business headlines…" : "No business headlines are currently available from the connected feeds."}</div>}
                </div>
                <p className="market-disclaimer">For actual prices and trading, connect a licensed market-data provider. No market quotes are shown here.</p>
              </section>
            </div>

            <section className="section-block" id="programming">
              <div className="section-title"><h2>Programming, explained</h2><span>Why developers choose these tools—and where each fits</span></div>
              <div className="lower-grid">
                <article className="panel">
                  <div className="panel-heading"><div><h2>Language field guide</h2><p>Use cases, reasons for adoption, and trade-offs</p></div></div>
                  <div className="language-list">
                    {languageGuides.map((language) => (
                      <div key={language.name}>
                        <div className="language-head"><strong>{language.name} <span style={{ fontWeight: 400 }}>· {language.detail}</span></strong><span>{languageMentions(language.sourceTerm) === undefined ? "HN data —" : `${formatNumber(languageMentions(language.sourceTerm))} HN mentions*`}</span></div>
                        <p className="explanation-copy">{language.reason}</p>
                      </div>
                    ))}
                  </div>
                  <p className="source-note">*Hacker News story mentions are a discussion proxy—not a ranking of all developers, jobs, or production code. Current-year totals are annualized by the backend.</p>
                </article>

                <article className="panel" id="latest">
                  <div className="panel-heading"><div><h2>Live technology brief</h2><p>Original headlines with context and a link to the publisher</p></div><button className="text-link" onClick={loadData}>{filteredStories.length} stories · refresh</button></div>
                  <div className="story-filters" aria-label="Filter stories by topic">
                    {["All topics", ...new Set(Object.values(topicInfo).map((topic) => topic.category))].map((topic) => (
                      <button
                        key={topic}
                        className={`filter-chip${selectedTopic === topic ? " active" : ""}`}
                        onClick={() => {
                          setSelectedTopic(topic);
                          setStoryLimit(10);
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                  <div className="story-list">
                    {visibleStories.length > 0 ? visibleStories.map((story) => (
                      <article className="story" key={story.link || `${story.title}-${story.date}`}>
                        <span className={`story-accent ${story.accent}`} />
                        <div>
                          <div className="story-meta"><span className="story-tag">{story.tag}</span><span>·</span><span>{story.time}</span><span>·</span><span>{story.sourceUrl ? new URL(story.sourceUrl).hostname : "Publisher link unavailable"}</span></div>
                          <h3>{story.sourceUrl ? <a href={story.sourceUrl} target="_blank" rel="noreferrer">{story.title}</a> : story.title}</h3>
                          {story.summary && <div className="story-source-summary"><strong>Source excerpt</strong>{story.summary.slice(0, 480)}{story.summary.length > 480 ? "…" : ""}</div>}
                          <div className="story-explainer"><strong>Why it matters</strong><p>{story.explanation.why}</p></div>
                          <div className="story-explainer"><strong>What to check next</strong><p>{story.explanation.watch}</p></div>
                        </div>
                      </article>
                    )) : <div className="empty-state">{isLoading ? "Loading headlines from your connected sources…" : query || selectedTopic !== "All topics" ? "No current headlines match this search or topic. Try another filter." : "No headlines are available. Confirm that the TechPulse backend is running and try refreshing."}</div>}
                  </div>
                  {filteredStories.length > storyLimit && (
                    <button className="load-more" onClick={() => setStoryLimit((limit) => limit + 10)}>
                      Show more headlines ({filteredStories.length - storyLimit} remaining)
                    </button>
                  )}
                </article>
              </div>
            </section>

            <section className="section-block" id="companies">
              <div className="section-title">
                <h2>Technology company directory</h2>
                <span>{visibleCompanies.length} profiles · Ethiopia and global organizations</span>
              </div>
              <div className="directory-controls">
                <input
                  type="search"
                  aria-label="Filter company directory"
                  placeholder="Filter companies or sectors..."
                  value={companyQuery}
                  onChange={(event) => setCompanyQuery(event.target.value)}
                />
                <select aria-label="Filter companies by country" value={companyCountry} onChange={(event) => setCompanyCountry(event.target.value)}>
                  <option>All countries</option>
                  {companyCountries.map((country) => <option key={country}>{country}</option>)}
                </select>
                <select aria-label="Filter companies by sector" value={companySector} onChange={(event) => setCompanySector(event.target.value)}>
                  <option>All sectors</option>
                  {companySectors.map((sector) => <option key={sector}>{sector}</option>)}
                </select>
              </div>
              {visibleCompanies.length > 0 ? (
                <div className="company-grid">
                  {visibleCompanies.map((company) => (
                    <article className="company-card" key={company.id}>
                      <h3>{company.name}</h3>
                      <span className="company-country">{company.country}</span>
                      <p>{company.description}</p>
                      <div className="company-sector-list">
                        {company.sectors.map((sector) => <span className="company-sector" key={sector}>{sector}</span>)}
                      </div>
                      <div className="company-status"><strong>Status:</strong> {company.status}. {company.statusNote}</div>
                      <div className="company-links">
                        <a href={company.officialUrl} target="_blank" rel="noreferrer">Official website ↗</a>
                        <button className="text-link" onClick={() => {
                          setQuery(company.name);
                          document.querySelector(".search-box input")?.focus();
                        }}>Search coverage</button>
                      </div>
                      <div className="company-coverage">
                        <strong>Latest collected coverage · not a verified company status</strong>
                        {company.latestCoverage.length ? company.latestCoverage.map((article, index) => {
                          const sourceUrl = getSourceUrl(article.link);
                          return sourceUrl ? (
                            <a href={sourceUrl} target="_blank" rel="noreferrer" key={article.link || `${article.title}-${index}`}>
                              {article.title} · {formatRelativeTime(article.date)}
                            </a>
                          ) : <span className="source-note" key={`${article.title}-${index}`}>{article.title} · {formatRelativeTime(article.date)}</span>;
                        }) : <span className="source-note">No company-specific coverage in the collected feeds.</span>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="panel empty-state">
                  {companyList.length ? "No company matches those filters." : "Company directory API is unavailable. Check backend status and refresh."}
                </div>
              )}
              <p className="source-note">This is an initial curated directory, not every company worldwide. A directory listing does not prove a company is currently operating, licensed, solvent, hiring, or offering a specific service. Verify current facts with the linked organization, regulator, or official company filing.</p>
            </section>

            <section className="section-block" id="ecosystem">
              <div className="section-title"><h2>Open-source ecosystem & release watch</h2><span>Live public data from GitHub and endoflife.date</span></div>
              <div className="lower-grid">
                <article className="panel">
                  <div className="panel-heading"><div><h2>Projects developers build on</h2><p>Public repository metadata · stars are not a quality score</p></div></div>
                  <div className="market-list">
                    {(insights?.repos || []).map((repo) => (
                      <div className="market-row" key={repo.repo}>
                        <div className="market-name"><div className="market-badge">GH</div><div><strong>{repo.repo}</strong><span>{repo.latest ? `Latest release ${repo.latest}${repo.latestDate ? ` · ${repo.latestDate}` : ""}` : "No release data returned"}</span></div></div>
                        <strong className="repository-stars">★ {formatNumber(repo.stars)}</strong>
                      </div>
                    ))}
                    {!insights?.repos?.length && <div className="empty-state">{apiErrors.some((error) => error.includes("/api/insights")) ? "GitHub data is unavailable; see the API status above." : "Repository data is loading or has not been built by the backend yet."}</div>}
                  </div>
                </article>
                <article className="panel">
                  <div className="panel-heading"><div><h2>Supported software versions</h2><p>Release and lifecycle data can help teams plan maintenance</p></div></div>
                  <div className="release-grid">
                    {Object.entries(insights?.releases || {}).map(([product, releases]) => (
                      <div className="release-item" key={product}>
                        <strong>{product}</strong>
                        <span>{releases.length ? releases.slice(0, 3).map((release) => `${release.v} · latest ${release.latest || "not listed"}`).join(" / ") : "No current release data"}</span>
                      </div>
                    ))}
                    {!Object.keys(insights?.releases || {}).length && <div className="empty-state">Release lifecycle data is loading or unavailable.</div>}
                  </div>
                  <p className="source-note">Lifecycle data is informational. Confirm support status and security guidance with each project's official documentation.</p>
                </article>
              </div>
            </section>

            {insights?.analysis && (
              <section className="section-block" aria-label="AI-assisted research notes">
                <article className="panel">
                  <div className="panel-heading"><div><h2>AI-assisted research notes</h2><p>Generated by the configured backend model from its collected data; check original sources before relying on it.</p></div></div>
                  <p className="analysis-copy">{insights.analysis}</p>
                </article>
              </section>
            )}

            <section className="section-block" aria-label="Data sources and limitations">
              <div className="section-title"><h2>Sources & how to read this dashboard</h2><span>Transparent, traceable, and not a substitute for primary research</span></div>
              <div className="source-status-grid">
                {sourceStatuses.map((source) => (
                  <div className="source-status" key={source.id}>
                    <span className={`source-status-dot${source.configured ? " configured" : ""}`} />
                    <div><strong>{source.label}</strong><span>{source.configured ? "Configured" : "Not configured"} · {source.detail}</span></div>
                  </div>
                ))}
              </div>
              <div className="source-strip">
                <div><strong>Google News RSS</strong><span>News search feeds grouped by topic</span></div>
                <div><strong>Hacker News & Algolia</strong><span>Developer discussion and story-mention history</span></div>
                <div><strong>GitHub REST API</strong><span>Repository stars and latest releases</span></div>
                <div><strong>endoflife.date</strong><span>Software release lifecycle information</span></div>
              </div>
              <p className="source-note">YouTube uses official channel RSS when channel IDs are configured. Telegram posts require a bot added to the channel and a configured webhook secret. TikTok content requires authorized API access or a public RSS feed supplied by the administrator; this project does not scrape private feeds or bypass platform access controls. This is not a complete global technology database. RSS may be delayed or fail. Financial headlines are not trading signals; no live prices are provided.</p>
            </section>
            <footer className="footer">SignalTech · Live public-source aggregation with article-by-article context · Verify important claims with primary sources</footer>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
