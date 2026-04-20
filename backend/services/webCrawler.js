const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

const DEFAULT_HEADERS = {
  'User-Agent': 'JobMatchBot/1.0 (+job discovery crawler)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const robotsCache = new Map();

function fetchText(urlString, timeoutMs = 10000, headers = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      reject(new Error(`Invalid URL: ${urlString}`));
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: { ...DEFAULT_HEADERS, ...headers },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => resolve(raw));
      },
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${urlString}`)));
    req.on('error', reject);
    req.end();
  });
}

function normaliseUrl(href, baseUrl) {
  if (!href) return '';
  try {
    const u = new URL(href, baseUrl);
    if (!/^https?:$/.test(u.protocol)) return '';
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
}

function looksLikeJobLink(url, anchorText = '') {
  const t = `${url} ${anchorText}`.toLowerCase();
  const hints = [
    '/jobs', '/job/', 'careers', 'workday', 'greenhouse', 'lever',
    'job-search', 'viewjob', 'naukri', 'linkedin.com/jobs', 'indeed.com',
  ];
  return hints.some((h) => t.includes(h));
}

function extractLinksFromHtml(html, baseUrl, allowedHostnames) {
  const $ = cheerio.load(html);
  const out = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const abs = normaliseUrl(href, baseUrl);
    if (!abs) return;

    try {
      const host = new URL(abs).hostname;
      if (allowedHostnames.size > 0 && !allowedHostnames.has(host)) return;
      if (looksLikeJobLink(abs, text)) out.push(abs);
    } catch {
      // Ignore malformed URLs
    }
  });

  return [...new Set(out)];
}

function parseRobotsDisallow(robotsText) {
  const lines = (robotsText || '').split(/\r?\n/);
  let inGlobalAgent = false;
  const disallow = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const key = line.substring(0, idx).trim().toLowerCase();
    const value = line.substring(idx + 1).trim();

    if (key === 'user-agent') {
      inGlobalAgent = value === '*';
      continue;
    }

    if (inGlobalAgent && key === 'disallow' && value) {
      disallow.push(value);
    }
  }

  return disallow;
}

async function getRobotsRules(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);

  const robotsUrl = `${origin}/robots.txt`;
  try {
    const text = await fetchText(robotsUrl, 8000);
    const rules = parseRobotsDisallow(text);
    robotsCache.set(origin, rules);
    return rules;
  } catch {
    robotsCache.set(origin, []);
    return [];
  }
}

async function isAllowedByRobots(urlString) {
  try {
    const u = new URL(urlString);
    const rules = await getRobotsRules(u.origin);
    const path = `${u.pathname}${u.search}`;
    return !rules.some((r) => r !== '/' && path.startsWith(r));
  } catch {
    return false;
  }
}

async function crawlJobLinks({
  seedUrls = [],
  maxPages = 20,
  maxDepth = 1,
} = {}) {
  const seeds = [...new Set((seedUrls || []).filter(Boolean))].slice(0, maxPages);
  const allowedHostnames = new Set();
  for (const s of seeds) {
    try {
      allowedHostnames.add(new URL(s).hostname);
    } catch {
      // Skip invalid seed
    }
  }

  const queue = seeds.map((url) => ({ url, depth: 0 }));
  const visited = new Set();
  const found = new Set();

  while (queue.length > 0 && visited.size < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    // Respect robots.txt per host.
    // If blocked for this path, skip fetch.
    const allowed = await isAllowedByRobots(url);
    if (!allowed) continue;

    let html;
    try {
      html = await fetchText(url, 10000);
    } catch {
      continue;
    }

    const links = extractLinksFromHtml(html, url, allowedHostnames);
    for (const link of links) {
      found.add(link);
      if (depth < maxDepth && !visited.has(link)) {
        queue.push({ url: link, depth: depth + 1 });
      }
    }
  }

  return [...found].slice(0, maxPages);
}

module.exports = {
  crawlJobLinks,
  extractLinksFromHtml,
  looksLikeJobLink,
  normaliseUrl,
};
