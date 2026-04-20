/**
 * Job Discovery Worker
 *
 * Background cron job that runs every 10 minutes to keep the job database
 * fresh.  For each unique set of skills found in recently-uploaded resumes
 * the worker:
 *
 *   1. Searches for job listings via scrapeAllJobs (RemoteOK + Adzuna +
 *      The Muse + Google via Serper API when SERPER_API_KEY is set).
 *   2. Upserts new jobs into the ScrapedJob collection (skips duplicates).
 *
 * The worker only runs when a MongoDB connection is available and degrades
 * gracefully if any external API is unreachable.
 *
 * Usage (called once from server.js at startup):
 *
 *   const { startJobDiscoveryWorker } = require('./workers/jobDiscovery');
 *   startJobDiscoveryWorker();
 */

const cron = require('node-cron');
const Resume = require('../models/Resume');
const ScrapedJob = require('../models/ScrapedJob');
const { scrapeAllJobs } = require('../services/jobScraper');

// How many unique skill-sets to process per run (avoids hammering external APIs)
const MAX_SKILL_SETS_PER_RUN = 5;

/**
 * Core discovery logic – fetch jobs for the given skill set and persist them.
 *
 * @param {string[]} skills - Deduplicated skill keywords
 * @returns {Promise<number>} Number of new jobs inserted
 */
async function discoverAndStore(skills) {
  if (!skills || skills.length === 0) return 0;

  // Use a minimal "resume" stub so normalizeAndMatch can compute scores
  const resumeStub = { skills, rawText: skills.join(' ') };

  let scraped;
  try {
    scraped = await scrapeAllJobs(skills, resumeStub, 50);
  } catch (err) {
    console.warn('[JobDiscovery] scrapeAllJobs failed:', err.message);
    return 0;
  }

  let inserted = 0;
  for (const result of scraped) {
    const raw = result.job || {};
    const source = result.source || 'scraped';

    // Build the document to upsert
    const jobDoc = {
      title: raw.title || 'Software Engineer',
      company: raw.company || '',
      location: raw.location || 'Remote',
      salary: raw.salary || '',
      description: raw.description || '',
      requiredSkills: raw.requiredSkills || raw.skills || [],
      url: raw.url || '',
      source,
      externalId: result.externalId || raw.url || '',
      postedDate: raw.postedDate || null,
      isActive: true,
      scrapedAt: new Date(),
    };

    // Skip if there's no meaningful identifier for deduplication
    if (!jobDoc.externalId && !jobDoc.url) continue;

    try {
      const filter = jobDoc.externalId
        ? { externalId: jobDoc.externalId, source: jobDoc.source }
        : { title: jobDoc.title, company: jobDoc.company, source: jobDoc.source };

      const existing = await ScrapedJob.findOne(filter);
      if (!existing) {
        await ScrapedJob.create(jobDoc);
        inserted++;
      }
    } catch (err) {
      // Swallow duplicate-key errors (race conditions between concurrent runs)
      if (err.code !== 11000) {
        console.error('[JobDiscovery] Save error:', err.message);
      }
    }
  }

  return inserted;
}

/**
 * One full discovery run: sample recent resumes, collect unique skill sets,
 * and fetch + store matching jobs.
 */
async function runDiscovery() {
  console.log('[JobDiscovery] Starting job discovery run…');

  let resumes;
  try {
    // Use the 20 most recently updated resumes to drive the search queries
    resumes = await Resume.find({})
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('skills');
  } catch (err) {
    console.error('[JobDiscovery] Could not load resumes:', err.message);
    return;
  }

  if (!resumes || resumes.length === 0) {
    console.log('[JobDiscovery] No resumes found – skipping run');
    return;
  }

  // Deduplicate skill sets so we don't repeat identical searches
  const seenKeys = new Set();
  const skillSets = [];
  for (const resume of resumes) {
    const skills = (resume.skills || []).slice(0, 8);
    if (skills.length === 0) continue;
    const key = skills.slice().sort().join(',').toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    skillSets.push(skills);
    if (skillSets.length >= MAX_SKILL_SETS_PER_RUN) break;
  }

  let totalInserted = 0;
  for (const skills of skillSets) {
    const count = await discoverAndStore(skills);
    totalInserted += count;
  }

  console.log(`[JobDiscovery] Run complete – ${totalInserted} new job(s) stored`);
}

/**
 * Start the background cron job.
 * Schedules runDiscovery() every 10 minutes.
 *
 * @returns {{ stop: function }} Handle to stop the cron job if needed.
 */
function startJobDiscoveryWorker() {
  // Run once on startup (after a short delay to let the DB connect)
  setTimeout(() => {
    runDiscovery().catch((err) =>
      console.error('[JobDiscovery] Initial run error:', err.message),
    );
  }, 15000); // 15-second delay gives the server time to fully start

  // Then repeat every 10 minutes
  const task = cron.schedule('*/10 * * * *', () => {
    runDiscovery().catch((err) =>
      console.error('[JobDiscovery] Scheduled run error:', err.message),
    );
  });

  console.log('[JobDiscovery] Background worker started (runs every 10 minutes)');
  return task;
}

module.exports = { startJobDiscoveryWorker, runDiscovery, discoverAndStore };
