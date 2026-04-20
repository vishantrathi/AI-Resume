/**
 * Job Scraper Utility
 *
 * Fetches job listings from public APIs (RemoteOK) and other free job sources.
 * Jobs are cleaned, skill-tagged, and returned ready to store in MongoDB.
 */

const https = require('https');
const { extractSkills } = require('./nlpProcessor');

/**
 * Fetch JSON from a URL using Node's built-in https module.
 * @param {string} url
 * @param {object} headers
 * @returns {Promise<any>}
 */
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'AI-Resume-Matcher/1.0 (job discovery bot)',
        'Accept': 'application/json',
        ...headers,
      },
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Strip HTML tags from a string and decode common HTML entities in a single pass.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // Remove all HTML tags first
  const noTags = html.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities in a single pass to avoid double-unescaping
  const ENTITIES = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&amp;': '&',
  };

  return noTags
    .replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, (match) => ENTITIES[match] || match)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Scrape jobs from RemoteOK public API.
 * @param {string[]} keywords - Skills/keywords to search for
 * @returns {Promise<object[]>}
 */
async function scrapeRemoteOK(keywords = []) {
  const url = 'https://remoteok.com/api';
  let jobs = [];
  try {
    const data = await fetchJSON(url);
    // First element is a legal notice object, skip it
    const listings = Array.isArray(data) ? data.slice(1) : [];

    for (const item of listings) {
      if (!item || typeof item !== 'object' || !item.position) continue;

      const description = stripHtml(item.description || '');
      const tagsFromApi = Array.isArray(item.tags) ? item.tags : [];
      const extractedSkills = extractSkills(description + ' ' + tagsFromApi.join(' '));
      const combinedSkills = [...new Set([...tagsFromApi, ...extractedSkills])].slice(0, 20);

      // Filter by keywords if provided
      if (keywords.length > 0) {
        const textToSearch = (item.position + ' ' + description + ' ' + tagsFromApi.join(' ')).toLowerCase();
        const hasKeyword = keywords.some((kw) => textToSearch.includes(kw.toLowerCase()));
        if (!hasKeyword) continue;
      }

      jobs.push({
        title: item.position || 'Unknown Position',
        company: item.company || '',
        location: item.location || 'Remote',
        salary: item.salary || '',
        description: description.substring(0, 2000),
        requiredSkills: combinedSkills,
        url: item.url || `https://remoteok.com/l/${item.slug || item.id}`,
        source: 'remoteok',
        externalId: String(item.id || item.slug || ''),
      });
    }
  } catch (err) {
    console.error('[Scraper] RemoteOK fetch failed:', err.message);
  }
  return jobs;
}

/**
 * Compatibility helper retained for older call-sites/tests.
 * Synthetic job generation is intentionally disabled.
 * @returns {object[]}
 */
function generateFallbackJobs() {
  return [];
}

/**
 * Main scraping orchestrator.
 * Returns only externally discovered jobs.
 *
 * @param {string[]} skills - Resume skills to search for
 * @param {number} limit    - Max number of jobs to return
 * @returns {Promise<object[]>}
 */
async function scrapeJobs(skills = [], limit = 50) {
  const keywords = skills.slice(0, 8); // Use top skills as search terms
  const jobs = await scrapeRemoteOK(keywords);

  // De-duplicate by externalId
  const seen = new Set();
  const unique = [];
  for (const job of jobs) {
    const key = job.externalId || job.url;
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      unique.push(job);
    }
  }

  return unique.slice(0, limit);
}

module.exports = { scrapeJobs, scrapeRemoteOK, generateFallbackJobs };
