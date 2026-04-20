/**
 * Google Job Search Service
 *
 * Uses the Serper API (https://serper.dev) to perform real-time Google searches
 * for job listings across multiple portals (LinkedIn, Indeed, Glassdoor, Naukri,
 * Internshala, Wellfound, and company career pages).
 *
 * Preferred mode:
 *   - ScrapingBee Google Jobs extraction (when SCRAPINGBEE_API_KEY is set)
 *
 * Fallback modes:
 *   - Serper API (when SERPER_API_KEY is set)
 *   - DuckDuckGo HTML search (when no API keys are set)
 *
 * Environment variables:
 *   SCRAPINGBEE_API_KEY – ScrapingBee API key (https://www.scrapingbee.com/)
 *   SCRAPINGBEE_COUNTRY_CODE – Optional geo routing for ScrapingBee (default: us)
 *   GOOGLE_JOBS_LOCATION – Optional default location for Google Jobs query (default: USA)
 *   SERPER_API_KEY  – Serper.dev API key (https://serper.dev/api-key)
 */

const https = require('https');
const { URL } = require('url');

// ─── Job-portal URL patterns ──────────────────────────────────────────────────
const PORTAL_PATTERNS = [
  { pattern: 'linkedin.com/jobs', source: 'linkedin' },
  { pattern: 'indeed.com', source: 'indeed' },
  { pattern: 'glassdoor.com', source: 'glassdoor' },
  { pattern: 'naukri.com', source: 'naukri' },
  { pattern: 'internshala.com', source: 'internshala' },
  { pattern: 'wellfound.com', source: 'wellfound' },
  { pattern: 'angel.co', source: 'wellfound' },
  { pattern: 'greenhouse.io', source: 'company' },
  { pattern: 'lever.co', source: 'company' },
  { pattern: 'workday.com', source: 'company' },
  { pattern: 'careers.', source: 'company' },
  { pattern: '/jobs/', source: 'company' },
];

/**
 * Infer the source portal from a URL.
 * @param {string} url
 * @returns {string}
 */
function inferSource(url) {
  const lower = (url || '').toLowerCase();
  for (const { pattern, source } of PORTAL_PATTERNS) {
    if (lower.includes(pattern)) return source;
  }
  return 'web';
}

/**
 * Decode a DuckDuckGo redirect URL (/?uddg=<target>) into the target URL.
 * @param {string} href
 * @returns {string}
 */
function decodeDuckDuckGoRedirect(href) {
  try {
    const parsed = new URL(href, 'https://duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return href;
  } catch {
    return href;
  }
}

/**
 * Fetch plain text from URL using GET.
 * @param {string} url
 * @param {object} headers
 * @returns {Promise<string>}
 */
function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        ...headers,
      },
    };

    https
      .get(url, opts, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve(raw));
      })
      .on('error', reject);
  });
}

/**
 * Fetch JSON from URL using GET.
 * @param {string} url
 * @param {object} headers
 * @returns {Promise<any>}
 */
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        ...headers,
      },
    };

    https
      .get(url, opts, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`JSON parse error from ${url}: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Search jobs through DuckDuckGo HTML endpoint (no API key required).
 * @param {string} query
 * @returns {Promise<Array<{ title: string, link: string, snippet: string }>>}
 */
async function duckDuckGoSearch(query) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const html = await fetchText(url);
    const results = [];

    const resultPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;

    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      const rawHref = match[1] || '';
      const cleanHref = decodeDuckDuckGoRedirect(rawHref)
        .replace(/&amp;/g, '&')
        .trim();

      const title = (match[2] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const snippetRaw = (match[3] || match[4] || '');
      const snippet = snippetRaw
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanHref || !/^https?:\/\//i.test(cleanHref)) continue;

      results.push({ title, link: cleanHref, snippet });
      if (results.length >= 10) break;
    }

    return results;
  } catch (err) {
    console.warn(`[GoogleJobSearch] DuckDuckGo search failed for "${query}":`, err.message);
    return [];
  }
}

function buildGoogleJobsSearchUrl(position = 'software developer', location = 'USA') {
  const role = String(position || 'software developer').trim().replace(/\s+/g, '+');
  const where = String(location || 'USA').trim().replace(/\s+/g, '+');
  return `https://www.google.com/search?q=${role}+job+near+${where}&udm=8`;
}

function normaliseGoogleJobDetailUrl(href = '') {
  if (!href || typeof href !== 'string') return '';
  if (/^https?:\/\//i.test(href)) return href;

  try {
    const parsed = new URL(href, 'https://www.google.com');
    // Google often uses /url?q=<target>
    const q = parsed.searchParams.get('q');
    if (q && /^https?:\/\//i.test(q)) return q;
    if (/^https?:\/\//i.test(parsed.toString())) return parsed.toString();
  } catch {
    // Ignore malformed URLs and return empty
  }

  return '';
}

function mapScrapingBeeGoogleJobs(rawJobs = []) {
  return (rawJobs || [])
    .map((item) => {
      const url = normaliseGoogleJobDetailUrl(item.job_detail || item.url || '');
      const source = inferSource(url);
      const snippet = [
        item.location_and_portal,
        item.posted,
        item.employment_type,
        item.salary,
      ]
        .filter(Boolean)
        .join(' | ');

      return {
        url,
        source,
        title: item.title || '',
        snippet,
      };
    })
    .filter((r) => r.url && /^https?:\/\//i.test(r.url));
}

/**
 * Query Google Jobs panel through ScrapingBee extraction rules.
 * @param {string[]} skills
 * @param {{ maxUrls?: number }} options
 * @returns {Promise<Array<{ url: string, source: string, title: string, snippet: string }>>}
 */
async function searchGoogleJobsWithScrapingBee(skills, { maxUrls = 30 } = {}) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return [];

  const position = (skills || []).slice(0, 3).join(' ') || 'software developer';
  const location = process.env.GOOGLE_JOBS_LOCATION || 'USA';
  const country = process.env.SCRAPINGBEE_COUNTRY_CODE || 'us';
  const targetUrl = buildGoogleJobsSearchUrl(position, location);

  const extractRules = {
    jobs: {
      selector: '.EimVGf',
      type: 'list',
      output: {
        title: 'div.tNxQIb.PUpOsf',
        company: 'div.wHYlTd.MKCbgd.a3jPc',
        location_and_portal: 'div.wHYlTd.FqK3wc.MKCbgd',
        posted: 'span[aria-label$=ago]',
        employment_type: 'span[aria-label^=Employment]',
        salary: 'span[aria-label^=Salary]',
        job_detail: '.MQUd2b@href',
      },
    },
  };

  const qs = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
    custom_google: 'true',
    stealth_proxy: 'true',
    render_js: 'true',
    country_code: country,
    extract_rules: JSON.stringify(extractRules),
  });

  const endpoint = `https://app.scrapingbee.com/api/v1/?${qs.toString()}`;
  try {
    const payload = await fetchJSON(endpoint);
    const parsed = mapScrapingBeeGoogleJobs(payload.jobs || []);

    // Deduplicate and cap
    const seen = new Set();
    const out = [];
    for (const row of parsed) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      out.push(row);
      if (out.length >= maxUrls) break;
    }

    return out;
  } catch (err) {
    console.warn('[GoogleJobSearch] ScrapingBee Google Jobs failed:', err.message);
    return [];
  }
}

// ─── HTTP POST helper ─────────────────────────────────────────────────────────
function postJSON(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const [protocol, rest] = url.split('://');
    const slashIdx = rest.indexOf('/');
    const hostname = rest.substring(0, slashIdx === -1 ? rest.length : slashIdx);
    const path = slashIdx === -1 ? '/' : rest.substring(slashIdx);

    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };

    const mod = protocol === 'https' ? https : require('http');
    const req = mod.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`JSON parse error from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Query generation ─────────────────────────────────────────────────────────

/**
 * Build a list of Google search queries from resume skills.
 *
 * Generates two classes of queries:
 *   1. General role queries  – "React developer jobs", "Node.js backend developer jobs"
 *   2. Site-scoped queries   – "site:linkedin.com/jobs React developer"
 *
 * @param {string[]} skills - Extracted resume skills (up to ~10 used)
 * @returns {string[]} Array of search query strings
 */
function buildSearchQueries(skills) {
  const top = skills.slice(0, 8);
  if (top.length === 0) return ['software developer jobs'];

  const queries = [];

  // General role queries
  const primarySkills = top.slice(0, 3);
  queries.push(`${primarySkills.join(' ')} developer jobs`);
  queries.push(`${primarySkills.join(' ')} engineer jobs`);
  if (top.length > 3) {
    queries.push(`${top.slice(0, 5).join(' OR ')} software jobs`);
  }

  // Site-scoped queries for each major portal
  const siteTargets = [
    'site:linkedin.com/jobs',
    'site:indeed.com',
    'site:naukri.com',
    'site:glassdoor.com',
    'site:internshala.com',
    'site:wellfound.com',
  ];

  const skillStr = primarySkills.join(' ');
  for (const site of siteTargets) {
    queries.push(`${site} ${skillStr} developer`);
  }

  return queries;
}

// ─── Serper API search ────────────────────────────────────────────────────────

/**
 * Perform a single Google search via the Serper API and return organic results.
 *
 * @param {string} query
 * @param {string} apiKey
 * @returns {Promise<Array<{ title, link, snippet }>>}
 */
async function serperSearch(query, apiKey) {
  try {
    const data = await postJSON(
      'https://google.serper.dev/search',
      { q: query, num: 10 },
      { 'X-API-KEY': apiKey },
    );
    return data.organic || [];
  } catch (err) {
    console.warn(`[GoogleJobSearch] Serper search failed for "${query}":`, err.message);
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Search Google for job listings matching the candidate's resume skills.
 *
 * Returns an array of job-page URLs deduped and annotated with their source
 * portal.  When SERPER_API_KEY is not configured the function returns [] so the
 * rest of the pipeline can fall back to its existing API-based sources.
 *
 * @param {string[]} skills    - Resume skills extracted by NLP
 * @param {object}   [options]
 * @param {number}   [options.maxUrls=30] - Maximum URLs to return
 * @returns {Promise<Array<{ url: string, source: string, title: string, snippet: string }>>}
 */
async function searchJobsOnGoogle(skills, { maxUrls = 30 } = {}) {
  const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;
  if (scrapingBeeKey) {
    const googleJobs = await searchGoogleJobsWithScrapingBee(skills, { maxUrls });
    if (googleJobs.length > 0) return googleJobs;
    console.warn('[GoogleJobSearch] ScrapingBee returned no jobs – falling back to Serper/DuckDuckGo');
  }

  const apiKey = process.env.SERPER_API_KEY;
  const queries = buildSearchQueries(skills);
  const seen = new Set();
  const results = [];

  if (!apiKey) {
    console.info('[GoogleJobSearch] SERPER_API_KEY not set – using DuckDuckGo fallback');
  }

  // Run searches sequentially to respect rate limits and avoid getting blocked
  for (const query of queries) {
    if (results.length >= maxUrls) break;

    const organic = apiKey
      ? await serperSearch(query, apiKey)
      : await duckDuckGoSearch(query);

    for (const item of organic) {
      const url = item.link || '';
      if (!url || seen.has(url)) continue;

      const source = inferSource(url);
      // Only keep URLs that look like actual job listings
      if (source === 'web' && !url.toLowerCase().includes('job')) continue;

      seen.add(url);
      results.push({
        url,
        source,
        title: item.title || '',
        snippet: item.snippet || '',
      });

      if (results.length >= maxUrls) break;
    }
  }

  return results;
}

module.exports = {
  searchJobsOnGoogle,
  buildSearchQueries,
  inferSource,
  duckDuckGoSearch,
  decodeDuckDuckGoRedirect,
  buildGoogleJobsSearchUrl,
  normaliseGoogleJobDetailUrl,
  mapScrapingBeeGoogleJobs,
  searchGoogleJobsWithScrapingBee,
};
