/**
 * Scrape Controller
 *
 * POST /api/jobs/scrape
 * Triggers job discovery from external sources based on candidate skills,
 * stores new jobs in ScrapedJob collection, and returns match scores.
 */

const Resume = require('../models/Resume');
const ScrapedJob = require('../models/ScrapedJob');
const Match = require('../models/Match');
const { scrapeAllJobs } = require('../services/jobScraper');
const { calculateMatch } = require('../utils/matcher');

const MAX_JOB_AGE_DAYS = 60;

/**
 * POST /api/jobs/scrape
 * Candidate-only: scrape jobs matching the candidate's resume skills.
 */
const scrapeAndMatchJobs = async (req, res) => {
  const resume = await Resume.findOne({ candidate: req.user.id });
  if (!resume) return res.status(404).json({ message: 'Please upload a resume first' });

  const skills = resume.skills || [];
  if (skills.length === 0) {
    return res.status(422).json({ message: 'No skills found in resume. Please re-upload.' });
  }

  // Scrape jobs from external sources
  const scrapedData = await scrapeAllJobs(skills, resume, 50);

  if (scrapedData.length === 0) {
    return res.json({ message: 'No jobs found from external sources', matches: [] });
  }

  // Upsert scraped jobs into MongoDB (avoid duplicates)
  const savedJobs = [];
  for (const item of scrapedData) {
    const jobData = item.job
      ? {
          ...item.job,
          source: item.source,
          externalId: item.externalId || item.job.url || '',
          requiredSkills: item.job.requiredSkills || item.job.skills || [],
        }
      : item;

    try {
      const filter = jobData.externalId
        ? { externalId: jobData.externalId, source: jobData.source }
        : { title: jobData.title, company: jobData.company, source: jobData.source };

      const job = await ScrapedJob.findOneAndUpdate(filter, jobData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
      savedJobs.push(job);
    } catch (err) {
      // Skip duplicate key errors silently
      if (err.code !== 11000) console.error('[Scrape] Save error:', err.message);
    }
  }

  // Calculate match scores
  const results = [];
  for (const job of savedJobs) {
    const { matchingScore, matchedSkills, missingSkills } = calculateMatch(resume, job);
    results.push({
      job: {
        _id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        requiredSkills: job.requiredSkills,
        url: job.url,
        source: job.source,
      },
      matchingScore,
      matchedSkills,
      missingSkills,
    });
  }

  // Sort by match score descending
  results.sort((a, b) => b.matchingScore - a.matchingScore);

  res.json({
    message: `Discovered ${savedJobs.length} jobs from external sources`,
    matches: results,
  });
};

/**
 * GET /api/jobs/scraped
 * Return all stored scraped jobs (public endpoint).
 */
const getScrapedJobs = async (req, res) => {
  const { search, location, limit = 50, page = 1 } = req.query;
  const cutoff = new Date(Date.now() - MAX_JOB_AGE_DAYS * 24 * 60 * 60 * 1000);
  const filter = {
    isActive: true,
    postedDate: { $gte: cutoff },
  };

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (location) {
    filter.location = { $regex: location, $options: 'i' };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const jobs = await ScrapedJob.find(filter)
    .sort({ scrapedAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await ScrapedJob.countDocuments(filter);

  res.json({ jobs, total, page: Number(page), limit: Number(limit) });
};

module.exports = { scrapeAndMatchJobs, getScrapedJobs };
