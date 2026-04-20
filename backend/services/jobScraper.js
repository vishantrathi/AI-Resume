/**
 * Job Scraper Service
 *
 * Fetches job listings from multiple sources:
 *   1. Google search via Serper API (googleJobSearch) — real-time, multi-portal
 *   2. RemoteOK public API           — reliable fallback
 *   3. Adzuna API                    — broad job listings
 *   4. The Muse API                  — company-focused roles
 *
 * Results are cached in memory for 10 minutes to avoid excessive requests.
 * Jobs are normalised into a consistent format ready for match scoring.
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const { extractSkills } = require('../utils/nlpProcessor');
const { calculateMatch } = require('../utils/matcher');
const { searchJobsOnGoogle, inferSource } = require('./googleJobSearch');
const { crawlJobLinks } = require('./webCrawler');

// ─── In-memory cache ────────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'AI-Resume-Matcher/2.0 (job discovery service)',
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

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'AI-Resume-Matcher/2.0 (job discovery service)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

function postJSON(urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch (err) {
      reject(new Error(`Invalid URL: ${urlString}`));
      return;
    }

    const payload = JSON.stringify(body || {});
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
      timeout: 12000,
    };

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`JSON parse error from ${urlString}: ${e.message}`));
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error(`Request timeout for ${urlString}`)));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function enrichUrlsWithNlpScraper(urlItems = []) {
  const nlpBase = process.env.NLP_SERVICE_URL;
  if (!nlpBase || !Array.isArray(urlItems) || urlItems.length === 0) {
    return new Map();
  }

  const urls = [...new Set(urlItems.map((u) => u.url).filter(Boolean))].slice(0, 25);
  if (urls.length === 0) return new Map();

  const endpoint = `${nlpBase.replace(/\/$/, '')}/scrape-job-pages`;
  try {
    const payload = await postJSON(endpoint, { urls, max_text_chars: 4000 });
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    const out = new Map();
    for (const row of rows) {
      if (row?.url) out.set(row.url, row);
    }
    return out;
  } catch (err) {
    console.warn('[JobScraper] NLP scrape enrichment failed:', err.message);
    return new Map();
  }
}

// ─── HTML stripping ──────────────────────────────────────────────────────────
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  const ENTITIES = {
    '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&nbsp;': ' ', '&amp;': '&',
  };
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, (m) => ENTITIES[m] || m)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normaliseJobTitle(rawTitle = '') {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  // Remove common site suffixes from browser tab titles.
  return rawTitle
    .replace(/\s*[|\-]\s*(linkedin|indeed|naukri|glassdoor|wellfound|the muse|jobs?)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const MAX_JOB_AGE_DAYS = 60;

function parsePostedDateFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  if (lower.includes('today') || lower.includes('just now')) return new Date();
  if (lower.includes('yesterday')) return new Date(Date.now() - 24 * 60 * 60 * 1000);

  const match = lower.match(/(\d+)\s*(hour|day|week|month|year)s?\s*ago/);
  if (!match) return null;

  const n = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(n) || n <= 0) return null;

  const now = new Date();
  if (unit === 'hour') return new Date(now.getTime() - n * 60 * 60 * 1000);
  if (unit === 'day') return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  if (unit === 'week') return new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
  if (unit === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    return d;
  }
  if (unit === 'year') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - n);
    return d;
  }

  return null;
}

function isRecentPostedDate(value, maxAgeDays = MAX_JOB_AGE_DAYS) {
  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const ageMs = Date.now() - date.getTime();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

// ─── Normalisation ───────────────────────────────────────────────────────────
/**
 * Normalise a raw job object into the standard scraped-job shape and
 * compute match scores against the candidate's resume.
 *
 * @param {object} raw    - Source job object
 * @param {object} resume - { skills: string[], rawText: string }
 * @param {string} src    - Source label ('linkedin'|'indeed'|'naukri'|…)
 * @returns {{ job, match, source }}
 */
function normalizeAndMatch(raw, resume, src) {
  const job = {
    title: raw.title || 'Software Engineer',
    company: raw.company || '',
    location: raw.location || 'Remote',
    skills: (raw.requiredSkills || []).slice(0, 30),
    description: (raw.description || '').substring(0, 2000),
    url: raw.url || '',
    salary: raw.salary || '',
    postedDate: raw.postedDate || null,
  };

  const matchResult = calculateMatch(
    { skills: resume.skills || [], rawText: resume.rawText || '' },
    { requiredSkills: job.skills, description: job.description },
  );

  return {
    job,
    match: {
      matchingScore: matchResult.matchingScore,
      matchedSkills: matchResult.matchedSkills,
      missingSkills: matchResult.missingSkills,
    },
    // Expose the specific portal name as the source so the frontend can show
    // "LinkedIn", "Indeed", etc. instead of a generic "scraped" label.
    source: src || 'scraped',
    externalId: raw.externalId || raw.url || '',
  };
}

// ─── RemoteOK source (reliable public API) ───────────────────────────────────
async function fetchRemoteOK(keywords) {
  const url = 'https://remoteok.com/api';
  let jobs = [];
  try {
    const data = await fetchJSON(url);
    const listings = Array.isArray(data) ? data.slice(1) : [];

    for (const item of listings) {
      if (!item || !item.position) continue;

      const description = stripHtml(item.description || '');
      const tagsFromApi = Array.isArray(item.tags) ? item.tags : [];
      const extractedSkills = extractSkills(description + ' ' + tagsFromApi.join(' '));
      const combinedSkills = [...new Set([...tagsFromApi, ...extractedSkills])].slice(0, 20);

      if (keywords.length > 0) {
        const searchText = (item.position + ' ' + description + ' ' + tagsFromApi.join(' ')).toLowerCase();
        const hasKeyword = keywords.some((kw) => searchText.includes(kw.toLowerCase()));
        if (!hasKeyword) continue;
      }

      jobs.push({
        title: item.position || 'Software Engineer',
        company: item.company || '',
        location: item.location || 'Remote',
        salary: item.salary || '',
        description: description.substring(0, 2000),
        requiredSkills: combinedSkills,
        url: item.url || `https://remoteok.com/l/${item.slug || item.id}`,
        externalId: String(item.id || item.slug || ''),
        postedDate: item.date ? new Date(item.date * 1000) : null,
        source: 'remoteok',
      });
    }
  } catch (err) {
    console.warn('[JobScraper] RemoteOK fetch failed:', err.message);
  }
  return jobs;
}

// ─── Adzuna source (free job search API) ────────────────────────────────────
async function fetchAdzuna(keywords, country = 'gb') {
  // Adzuna offers a free public demo endpoint for educational use
  const queryTerms = (keywords || []).slice(0, 3);
  const query = encodeURIComponent(queryTerms.length > 0 ? queryTerms.join(' ') : 'software developer');
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=demo&app_key=demo&what=${query}&results_per_page=20&content-type=application/json`;

  let jobs = [];
  try {
    const data = await fetchJSON(url);
    const results = data.results || [];
    for (const item of results) {
      const description = stripHtml(item.description || '');
      const skills = extractSkills(description + ' ' + (item.title || ''));
      jobs.push({
        title: item.title || '',
        company: item.company?.display_name || '',
        location: item.location?.display_name || (item.location?.area || []).join(', ') || 'Remote',
        salary: item.salary_min && item.salary_max
          ? `$${Math.round(item.salary_min / 1000)}k - $${Math.round(item.salary_max / 1000)}k`
          : '',
        description: description.substring(0, 2000),
        requiredSkills: skills,
        url: item.redirect_url || '',
        externalId: item.id ? String(item.id) : '',
        postedDate: item.created ? new Date(item.created) : null,
        source: 'adzuna',
      });
    }
  } catch (err) {
    console.warn('[JobScraper] Adzuna fetch failed:', err.message);
  }
  return jobs;
}

async function fetchAdzunaBroad(keywords) {
  // Query multiple regions to improve diversity when one region has sparse results.
  const countries = ['us', 'gb', 'in'];
  const all = [];

  for (const country of countries) {
    const rows = await fetchAdzuna(keywords, country);
    all.push(...rows);
  }

  // If skill-specific query is too narrow, try one broad role query.
  if (all.length === 0) {
    for (const country of countries) {
      const rows = await fetchAdzuna(['software', 'developer'], country);
      all.push(...rows);
    }
  }

  return all;
}

// ─── LinkedIn source via ScrapingBee ───────────────────────────────────────
function buildLinkedInSearchUrl(keywords, start = 0, location = '') {
  const query = encodeURIComponent((keywords || []).slice(0, 5).join(' ') || 'software engineer');
  const loc = encodeURIComponent(location || 'India');
  return `https://www.linkedin.com/jobs/search/?keywords=${query}&location=${loc}&start=${start}`;
}

function normaliseLinkedInJobLink(href = '') {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `https://www.linkedin.com${href}`;
  return `https://www.linkedin.com/${href}`;
}

/**
 * Parse public LinkedIn jobs cards from search HTML.
 * @param {string} html
 * @returns {Array<object>}
 */
function extractLinkedInJobsFromHtml(html) {
  if (!html || typeof html !== 'string') return [];

  const $ = cheerio.load(html);
  const jobs = [];

  $('li .base-card, li .base-search-card, div.base-search-card, li.result-card, li.job-search-card').each((_, card) => {
    const root = $(card);

    const title =
      root.find('h3.base-search-card__title').first().text().trim()
      || root.find('h3.result-card__title').first().text().trim()
      || root.find('a.base-card__full-link').first().text().trim();

    const company =
      root.find('h4.base-search-card__subtitle a').first().text().trim()
      || root.find('h4.base-search-card__subtitle').first().text().trim()
      || root.find('h4.result-card__subtitle').first().text().trim()
      || '';

    const location =
      root.find('.job-search-card__location').first().text().trim()
      || root.find('.result-card__location').first().text().trim()
      || 'Remote';

    const posted =
      root.find('time.job-search-card__listdate').first().text().trim()
      || root.find('time.job-search-card__listdate--new').first().text().trim()
      || root.find('time').first().text().trim()
      || '';

    const urlHref =
      root.find('a.base-card__full-link').attr('href')
      || root.find('a.result-card__full-card-link').attr('href')
      || root.find('a.base-card__full-link[href]').first().attr('href')
      || '';
    const url = normaliseLinkedInJobLink(urlHref);

    if (!title || !url) return;

    const snippet = [company, location, posted].filter(Boolean).join(' | ');

    jobs.push({
      title,
      company,
      location,
      salary: '',
      description: snippet.substring(0, 2000),
      requiredSkills: extractSkills(`${title} ${company} ${location}`),
      url,
      externalId: url,
      postedDate: parsePostedDateFromText(posted),
      source: 'linkedin',
    });
  });

  return jobs;
}

async function fetchLinkedInGuestJobs(keywords, location = 'India', pages = 2) {
  const results = [];
  const seen = new Set();

  for (let page = 0; page < pages; page++) {
    const start = page * 25;
    const query = encodeURIComponent((keywords || []).slice(0, 5).join(' ') || 'software engineer');
    const loc = encodeURIComponent(location || 'India');
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${loc}&start=${start}`;

    try {
      const html = await fetchText(url, {
        Referer: 'https://www.linkedin.com/jobs',
        'Accept-Language': 'en-US,en;q=0.9',
      });

      const parsed = extractLinkedInJobsFromHtml(html);
      for (const job of parsed) {
        const key = job.externalId || job.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        results.push(job);
      }
    } catch (err) {
      console.warn(`[JobScraper] LinkedIn guest jobs page ${page + 1} failed:`, err.message);
    }
  }

  return results;
}

async function fetchLinkedInWithScrapingBee(keywords, location = 'India', pages = 2) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.info('[JobScraper] SCRAPINGBEE_API_KEY not set – skipping ScrapingBee LinkedIn source');
    return [];
  }

  const country = process.env.SCRAPINGBEE_COUNTRY_CODE || 'in';
  const results = [];
  const seen = new Set();

  for (let page = 0; page < pages; page++) {
    const start = page * 25;
    const linkedinUrl = buildLinkedInSearchUrl(keywords, start, location);
    const scrapingBeeUrl =
      `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(apiKey)}` +
      `&url=${encodeURIComponent(linkedinUrl)}` +
      `&render_js=true&country_code=${encodeURIComponent(country)}`;

    try {
      const html = await fetchText(scrapingBeeUrl);
      const parsed = extractLinkedInJobsFromHtml(html);
      for (const job of parsed) {
        const key = job.externalId || job.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        results.push(job);
      }
    } catch (err) {
      console.warn(`[JobScraper] ScrapingBee LinkedIn page ${page + 1} failed:`, err.message);
    }
  }

  return results;
}

// ─── Indeed source via ScrapingBee ──────────────────────────────────────────
function buildIndeedSearchUrl(keywords, start = 0, location = '') {
  const query = encodeURIComponent((keywords || []).slice(0, 5).join(' '));
  const loc = encodeURIComponent(location || 'Remote');
  return `https://www.indeed.com/jobs?q=${query}&l=${loc}&start=${start}`;
}

function normaliseIndeedJobLink(href = '') {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `https://www.indeed.com${href}`;
  return `https://www.indeed.com/${href}`;
}

/**
 * Parse job cards from an Indeed search HTML page.
 * @param {string} html
 * @returns {Array<object>}
 */
function extractIndeedJobsFromHtml(html) {
  if (!html || typeof html !== 'string') return [];

  const $ = cheerio.load(html);
  const jobs = [];

  $('div.job_seen_beacon').each((_, card) => {
    const root = $(card);

    const title =
      root.find('h2.jobTitle a span').first().text().trim()
      || root.find('h2.jobTitle span').first().text().trim()
      || root.find('[data-testid="jobTitle"]').first().text().trim();

    const company =
      root.find('span[data-testid="company-name"]').first().text().trim()
      || root.find('span.companyName').first().text().trim();

    const location =
      root.find('div[data-testid="text-location"]').first().text().trim()
      || root.find('[data-testid="job-location"]').first().text().trim()
      || 'Remote';

    const salary =
      root.find('[data-testid="attribute_snippet_testid"]').first().text().trim()
      || root.find('.salary-snippet-container').first().text().trim()
      || '';

    const snippet =
      root.find('div.job-snippet').first().text().replace(/\s+/g, ' ').trim()
      || '';

    const linkHref = root.find('h2.jobTitle a').attr('href') || '';
    const url = normaliseIndeedJobLink(linkHref);

    if (!title || !url) return;

    jobs.push({
      title,
      company,
      location,
      salary,
      description: snippet.substring(0, 2000),
      requiredSkills: extractSkills(`${title} ${snippet}`),
      url,
      externalId: url,
      postedDate: parsePostedDateFromText(snippet),
      source: 'indeed',
    });
  });

  return jobs;
}

async function fetchIndeedWithScrapingBee(keywords, location = 'Remote', pages = 2) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.info('[JobScraper] SCRAPINGBEE_API_KEY not set – skipping ScrapingBee Indeed source');
    return [];
  }

  const country = process.env.SCRAPINGBEE_COUNTRY_CODE || 'us';
  const results = [];
  const seen = new Set();

  for (let page = 0; page < pages; page++) {
    const start = page * 10;
    const indeedUrl = buildIndeedSearchUrl(keywords, start, location);
    const scrapingBeeUrl =
      `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(apiKey)}` +
      `&url=${encodeURIComponent(indeedUrl)}` +
      `&render_js=true&country_code=${encodeURIComponent(country)}`;

    try {
      const html = await fetchText(scrapingBeeUrl);
      const parsed = extractIndeedJobsFromHtml(html);
      for (const job of parsed) {
        const key = job.externalId || job.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        results.push(job);
      }
    } catch (err) {
      console.warn(`[JobScraper] ScrapingBee Indeed page ${page + 1} failed:`, err.message);
    }
  }

  return results;
}

// ─── The Muse source (free public API, no key required) ─────────────────────
async function fetchTheMuse(keywords) {
  const top = (keywords || []).slice(0, 3);
  const query = encodeURIComponent(top.length > 0 ? top.join(' OR ') : 'Software Engineer');
  const url = `https://www.themuse.com/api/public/jobs?descending=true&page=1&query=${query}`;

  let jobs = [];
  try {
    const data = await fetchJSON(url);
    const results = data.results || [];
    for (const item of results) {
      const description = (item.contents || '').replace(/<[^>]*>/g, ' ').trim().substring(0, 2000);
      const skills = extractSkills(description + ' ' + (item.name || ''));
      const location = (item.locations || []).map((l) => l.name).join(', ') || 'Remote';

      jobs.push({
        title: item.name || '',
        company: item.company?.name || '',
        location,
        salary: '',
        description,
        requiredSkills: skills,
        url: item.refs?.landing_page || '',
        externalId: item.id ? String(item.id) : '',
        postedDate: item.publication_date ? new Date(item.publication_date) : null,
        source: 'themuse',
      });
    }
  } catch (err) {
    console.warn('[JobScraper] The Muse fetch failed:', err.message);
  }
  return jobs;
}

function dedupeRawJobs(rawJobs = []) {
  const seen = new Set();
  const unique = [];

  for (const job of rawJobs) {
    const key = job.externalId || job.url;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    unique.push(job);
  }

  return unique;
}

function balanceJobsBySource(rawJobs = [], limit = 50) {
  const grouped = new Map();
  for (const job of rawJobs) {
    const src = job._src || 'unknown';
    if (!grouped.has(src)) grouped.set(src, []);
    grouped.get(src).push(job);
  }

  // Keep RemoteOK useful but not dominant when other sources exist.
  const hardCapBySource = {
    remoteok: 12,
  };

  const queues = [...grouped.entries()].map(([src, items]) => {
    const cap = hardCapBySource[src] || items.length;
    return { src, items: items.slice(0, cap), idx: 0 };
  });

  const out = [];
  let advanced = true;
  while (advanced && out.length < limit) {
    advanced = false;
    for (const q of queues) {
      if (q.idx < q.items.length && out.length < limit) {
        out.push(q.items[q.idx]);
        q.idx += 1;
        advanced = true;
      }
    }
  }

  return out;
}

// ─── Compatibility helper ───────────────────────────────────────────────────
function generateFallbackJobs() {
  return [];
}

// ─── Public scraping functions (named per the spec) ──────────────────────────

/**
 * Scrape LinkedIn job listings.
 * Primary: ScrapingBee-powered LinkedIn search parsing.
 * Fallback: RemoteOK if LinkedIn fetch yields no results.
 *
 * @param {string[]} skills - Candidate skills/keywords
 * @returns {Promise<object[]>} Raw job data from source
 */
async function scrapeLinkedInJobs(skills) {
  const cacheKey = `linkedin_or_remoteok:${skills.slice(0, 6).join(',').toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const linkedInLocation = process.env.LINKEDIN_JOBS_LOCATION || 'India';
  let raw = await fetchLinkedInWithScrapingBee(skills, linkedInLocation, 2);
  if (!raw || raw.length === 0) {
    raw = await fetchLinkedInGuestJobs(skills, linkedInLocation, 2);
  }
  if (!raw || raw.length === 0) {
    raw = await fetchRemoteOK(skills);
  }

  setCache(cacheKey, raw);
  return raw;
}

/**
 * Scrape Indeed listings.
 * Primary: ScrapingBee-powered Indeed HTML extraction.
 * Fallback: Adzuna API when ScrapingBee is unavailable.
 *
 * @param {string[]} skills - Candidate skills/keywords
 * @returns {Promise<object[]>} Raw job data from source
 */
async function scrapeIndeedJobs(skills) {
  const cacheKey = `indeed_or_adzuna:${skills.slice(0, 6).join(',').toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let raw = await fetchIndeedWithScrapingBee(skills, 'Remote', 2);
  if (!raw || raw.length === 0) {
    raw = await fetchAdzunaBroad(skills);
  }

  setCache(cacheKey, raw);
  return raw;
}

/**
 * Scrape The Muse job listings.
 * NOTE: This is not Naukri data. The function name is kept for backward compatibility.
 *
 * @param {string[]} skills - Candidate skills/keywords
 * @returns {Promise<object[]>} Raw job data from source
 */
async function scrapeNaukriJobs(skills) {
  const cacheKey = `themuse:${skills.slice(0, 6).join(',').toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const raw = await fetchTheMuse(skills);
  setCache(cacheKey, raw);
  return raw;
}

// ─── Main aggregator ─────────────────────────────────────────────────────────

/**
 * Scrape all sources and return 20–50 normalised, match-scored jobs.
 *
 * @param {string[]} skills - Candidate skills
 * @param {object}   resume - { skills: string[], rawText: string }
 * @param {number}   limit  - Max jobs to return (default 50)
 * @returns {Promise<Array<{ job, match, source, externalId }>>}
 */
async function scrapeAllJobs(skills, resume, limit = 50) {
  const aggregatorKey = `all:${skills.slice(0, 6).join(',').toLowerCase()}`;
  const cached = getCached(aggregatorKey);
  if (cached) {
    return cached
      .map((raw) => normalizeAndMatch(raw, resume, raw._src || 'scraped'))
      .slice(0, limit);
  }

  // Fetch from all sources concurrently (API sources + Google search)
  const [linkedIn, indeed, naukri, googleUrls] = await Promise.allSettled([
    scrapeLinkedInJobs(skills),
    scrapeIndeedJobs(skills),
    scrapeNaukriJobs(skills),
    searchJobsOnGoogle(skills, { maxUrls: 60 }),
  ]);

  // Convert Google search URL results into lightweight job objects using
  // the title and snippet extracted by the search engine.
  const googleJobs = [];
  if (googleUrls.status === 'fulfilled') {
    const discovered = [...googleUrls.value];

    // Crawl within seed domains to discover more job-specific links.
    try {
      const crawled = await crawlJobLinks({
        seedUrls: discovered.map((d) => d.url).filter(Boolean),
        maxPages: 20,
        maxDepth: 1,
      });

      for (const url of crawled) {
        if (!discovered.some((d) => d.url === url)) {
          discovered.push({ url, source: inferSource(url), title: '', snippet: '' });
        }
      }
    } catch (err) {
      console.warn('[JobScraper] Internal crawler skipped:', err.message);
    }

    const nlpEnriched = await enrichUrlsWithNlpScraper(discovered);

    for (const item of discovered) {
      const enriched = nlpEnriched.get(item.url);
      const description = (enriched?.description || item.snippet || '').substring(0, 2000);
      const title = normaliseJobTitle(enriched?.title || item.title || '');
      const skills_ = Array.isArray(enriched?.skills) && enriched.skills.length > 0
        ? enriched.skills
        : extractSkills(`${description} ${title}`);

      // Avoid showing misleading/generic cards when we couldn't extract a real title.
      if (!title || title.length < 4) continue;
      if (!description || description.length < 20) continue;

      googleJobs.push({
        title,
        company: '',
        location: 'Remote',
        salary: '',
        description,
        requiredSkills: skills_,
        url: item.url,
        externalId: item.url,
        postedDate: parsePostedDateFromText(description || item.snippet || ''),
        _src: item.source || 'web',
      });
    }
  }

  const allRaw = [
    ...(linkedIn.status === 'fulfilled' ? linkedIn.value.map((j) => ({ ...j, _src: j.source || 'remoteok' })) : []),
    ...(indeed.status === 'fulfilled' ? indeed.value.map((j) => ({ ...j, _src: j.source || 'indeed' })) : []),
    ...(naukri.status === 'fulfilled' ? naukri.value.map((j) => ({ ...j, _src: j.source || 'themuse' })) : []),
    ...googleJobs,
  ];

  const unique = dedupeRawJobs(allRaw);

  // Keep only jobs posted within the latest 60 days.
  const recentOnly = unique.filter((j) => isRecentPostedDate(j.postedDate));

  // Return only real, recent jobs from external sources.
  const source = balanceJobsBySource(recentOnly, limit * 2);

  // Cache raw results for re-use
  setCache(aggregatorKey, source);

  // Normalise and score
  const results = source
    .map((raw) => normalizeAndMatch(raw, resume, raw._src || 'scraped'))
    .sort((a, b) => b.match.matchingScore - a.match.matchingScore)
    .slice(0, limit);

  return results;
}

module.exports = {
  scrapeLinkedInJobs,
  scrapeIndeedJobs,
  scrapeNaukriJobs,
  scrapeAllJobs,
  normalizeAndMatch,
  generateFallbackJobs,
  // Exposed for testing
  _cache,
  getCached,
  setCache,
  extractIndeedJobsFromHtml,
  buildIndeedSearchUrl,
  normaliseIndeedJobLink,
  extractLinkedInJobsFromHtml,
  buildLinkedInSearchUrl,
  normaliseLinkedInJobLink,
};
