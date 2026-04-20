const Resume = require('../models/Resume');
const Job = require('../models/Job');
const ScrapedJob = require('../models/ScrapedJob');
const Match = require('../models/Match');
const JobAction = require('../models/JobAction');
const { calculateMatchEnhanced } = require('../utils/matcher');
const { scrapeJobs } = require('../utils/scraper');
const { scrapeAllJobs } = require('../services/jobScraper');

const MAX_JOB_AGE_DAYS = 60;

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildJobSignature(recLike) {
  const source = normalizeToken(recLike?.source || 'unknown');
  const job = recLike?.job || recLike || {};
  const jobId = normalizeToken(job._id || recLike?.jobId || recLike?.id);
  const url = normalizeToken(job.url || recLike?.url || job.applicationLink);
  const title = normalizeToken(job.title || recLike?.title);
  const company = normalizeToken(job.company || recLike?.company);
  const location = normalizeToken(job.location || recLike?.location);

  if (jobId) return `${source}::id::${jobId}`;
  if (url) return `${source}::url::${url}`;
  return `${source}::meta::${title}::${company}::${location}`;
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/**
 * Normalise a Match document + populated job into the unified recommendation shape.
 */
function normaliseMatchDoc(matchDoc) {
  const job = matchDoc.job || {};
  return {
    id: matchDoc._id ? String(matchDoc._id) : null,
    matchingScore: matchDoc.matchingScore,
    skillMatchScore: matchDoc.skillMatchScore || 0,
    matchedSkills: matchDoc.matchedSkills || [],
    missingSkills: matchDoc.missingSkills || [],
    job: {
      _id: job._id ? String(job._id) : null,
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      requiredSkills: job.requiredSkills || [],
      description: job.description || '',
      url: job.applicationLink || '',
      salary: job.salary || '',
    },
    source: 'db',
  };
}

/**
 * Normalise a scraped job + computed match into the unified recommendation shape.
 */
function normaliseScrapedMatch(scored) {
  const job = scored.job || {};
  const matchData = scored.match || {};
  const matchingScore = scored.matchingScore !== undefined ? scored.matchingScore : (matchData.matchingScore ?? 0);
  const matchedSkills = scored.matchedSkills !== undefined ? scored.matchedSkills : (matchData.matchedSkills ?? []);
  const missingSkills = scored.missingSkills !== undefined ? scored.missingSkills : (matchData.missingSkills ?? []);
  const jobSkillCount = (job.requiredSkills || job.skills || []).length;
  const skillMatchScore = jobSkillCount > 0
    ? Math.round((matchedSkills.length / jobSkillCount) * 100)
    : 0;
  return {
    id: scored._id ? String(scored._id) : null,
    matchingScore,
    skillMatchScore,
    matchedSkills,
    missingSkills,
    job: {
      _id: job._id ? String(job._id) : null,
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      requiredSkills: job.requiredSkills || job.skills || [],
      description: job.description || '',
      url: job.url || job.applicationLink || '',
      salary: job.salary || '',
    },
    // Preserve the specific portal label (linkedin, indeed, naukri, etc.) if
    // present; fall back to 'scraped' for backward compatibility.
    source: scored.source || 'scraped',
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/jobs/match
 * Calculate and persist match scores for the logged-in candidate.
 * Optionally pass { jobId } to match against a single job.
 */
const matchJobs = async (req, res) => {
  const resume = await Resume.findOne({ candidate: req.user.id });
  if (!resume) return res.status(404).json({ message: 'Please upload a resume first' });

  const jobFilter = { isActive: true };
  if (req.body.jobId) jobFilter._id = req.body.jobId;

  const jobs = await Job.find(jobFilter);
  if (jobs.length === 0) return res.json([]);

  const results = [];
  for (const job of jobs) {
    const { matchingScore, matchedSkills, missingSkills } = calculateMatchEnhanced(resume, job);
    const totalJobSkills = (job.requiredSkills || []).length;
    const skillMatchScore = totalJobSkills > 0
      ? Math.round((matchedSkills.length / totalJobSkills) * 100)
      : 0;

    const match = await Match.findOneAndUpdate(
      { candidate: req.user.id, resume: resume._id, job: job._id },
      { matchingScore, skillMatchScore, matchedSkills, missingSkills },
      { upsert: true, new: true },
    );

    results.push({
      match,
      job: {
        _id: job._id,
        title: job.title,
        company: job.company,
        requiredSkills: job.requiredSkills,
        location: job.location,
        applicationLink: job.applicationLink,
      },
    });
  }

  results.sort((a, b) => b.match.matchingScore - a.match.matchingScore);
  res.json(results);
};

/**
 * GET /api/jobs/recommendations
 * GET /api/jobs/recommendations/:userId   (admin / webhook variant)
 *
 * Returns previously-computed (or freshly computed) recommendations in a
 * unified shape: { id, matchingScore, matchedSkills, missingSkills, job, source }.
 *
 * Auto-triggers real-time job scraping when fewer than 10 recommendations exist.
 */
const getRecommendations = async (req, res) => {
  // Support optional :userId param for admin/service use; fall back to JWT user
  const candidateId = req.params.userId || req.user.id;

  const resume = await Resume.findOne({ candidate: candidateId });
  if (!resume) return res.status(404).json({ message: 'Please upload a resume first' });

  // ── Load existing DB matches ──────────────────────────────────────────────
  let matches = await Match.find({ candidate: candidateId, resume: resume._id })
    .populate('job')
    .sort({ matchingScore: -1 });

  const excludedActions = await JobAction.find({
    candidate: candidateId,
    actionType: { $in: ['applied', 'removed'] },
  }).select('jobSignature');
  const excludedSignatures = new Set(excludedActions.map((a) => a.jobSignature));

  // Compute on-the-fly if no matches yet
  if (matches.length === 0) {
    const jobs = await Job.find({ isActive: true });
    for (const job of jobs) {
      const { matchingScore, matchedSkills, missingSkills } = calculateMatchEnhanced(resume, job);
      const totalJobSkills = (job.requiredSkills || []).length;
      const skillMatchScore = totalJobSkills > 0
        ? Math.round((matchedSkills.length / totalJobSkills) * 100)
        : 0;
      await Match.findOneAndUpdate(
        { candidate: candidateId, resume: resume._id, job: job._id },
        { matchingScore, skillMatchScore, matchedSkills, missingSkills },
        { upsert: true, new: true },
      );
    }
    matches = await Match.find({ candidate: candidateId, resume: resume._id })
      .populate('job')
      .sort({ matchingScore: -1 });
  }

  // Filter out any matches where the job was deleted
  const dbResults = matches
    .filter((m) => m.job != null)
    .map(normaliseMatchDoc)
    .filter((result) => !excludedSignatures.has(buildJobSignature(result)));

  // ── Auto-trigger scraping when < 10 recommendations ──────────────────────
  if (dbResults.length < 10) {
    let scrapedResults = [];

    try {
      // Try the advanced multi-source scraper first
      const scraped = await scrapeAllJobs(resume.skills || [], resume, 50);
      scrapedResults = scraped
        .map(normaliseScrapedMatch)
        .filter((result) => !excludedSignatures.has(buildJobSignature(result)));
    } catch (advancedErr) {
      console.warn('[Recommendations] Advanced scraper failed, falling back:', advancedErr.message);

      // Fall back to the original scraper utility
      try {
        const legacyData = await scrapeJobs(resume.skills || [], 30);
        for (const jobData of legacyData) {
          try {
            const filter = jobData.externalId
              ? { externalId: jobData.externalId, source: jobData.source }
              : { title: jobData.title, company: jobData.company, source: jobData.source };
            await ScrapedJob.findOneAndUpdate(filter, jobData, {
              upsert: true, new: true, setDefaultsOnInsert: true,
            });
          } catch (err) {
            if (err.code !== 11000) console.error('[Recommendations] Scrape save error:', err.message);
          }
        }
        const cutoff = new Date(Date.now() - MAX_JOB_AGE_DAYS * 24 * 60 * 60 * 1000);
        const storedScraped = await ScrapedJob.find({ isActive: true, postedDate: { $gte: cutoff } })
          .sort({ scrapedAt: -1 })
          .limit(30);
        scrapedResults = storedScraped.map((job) => {
          const { matchingScore, matchedSkills, missingSkills } = calculateMatchEnhanced(resume, {
            requiredSkills: job.requiredSkills,
            description: job.description,
            title: job.title,
          });
          return normaliseScrapedMatch({
            matchingScore, matchedSkills, missingSkills, job, source: 'scraped',
          });
        }).filter((result) => !excludedSignatures.has(buildJobSignature(result)));
      } catch (legacyErr) {
        console.error('[Recommendations] Legacy scraper also failed:', legacyErr.message);
      }
    }

    // Merge DB and scraped results, deduplicate by title+company, sort by score
    const seen = new Set(dbResults.map((r) => buildJobSignature(r)));
    const fresh = scrapedResults.filter((r) => {
      const key = buildJobSignature(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const combined = [...dbResults, ...fresh].sort((a, b) => b.matchingScore - a.matchingScore);
    return res.json(combined);
  }

  res.json(dbResults);
};

/**
 * GET /api/candidate/profile
 * Returns the candidate profile with resume and top matches.
 */
const getCandidateProfile = async (req, res) => {
  const resume = await Resume.findOne({ candidate: req.user.id });
  const matches = resume
    ? await Match.find({ candidate: req.user.id, resume: resume._id })
        .populate('job', 'title company requiredSkills')
        .sort({ matchingScore: -1 })
        .limit(5)
    : [];

  const [appliedCount, removedCount, appliedJobs] = await Promise.all([
    JobAction.countDocuments({ candidate: req.user.id, actionType: 'applied' }),
    JobAction.countDocuments({ candidate: req.user.id, actionType: 'removed' }),
    JobAction.find({ candidate: req.user.id, actionType: 'applied' })
      .sort({ actionDate: -1 })
      .limit(8)
      .select('title company source location url actionDate matchingScore'),
  ]);

  res.json({
    resume: resume || null,
    topMatches: matches,
    jobTracker: {
      appliedCount,
      removedCount,
      appliedJobs,
    },
  });
};

/**
 * POST /api/candidate/job-actions
 * Body: { actionType: 'applied'|'removed', recommendation: { ... } }
 */
const markJobAction = async (req, res) => {
  const { actionType, recommendation } = req.body || {};
  if (!['applied', 'removed'].includes(actionType)) {
    return res.status(400).json({ message: 'Invalid action type' });
  }

  const signature = buildJobSignature(recommendation);
  if (!signature) {
    return res.status(400).json({ message: 'Unable to identify this job' });
  }

  const job = recommendation?.job || recommendation || {};
  const opposite = actionType === 'applied' ? 'removed' : 'applied';

  await JobAction.deleteOne({
    candidate: req.user.id,
    actionType: opposite,
    jobSignature: signature,
  });

  const action = await JobAction.findOneAndUpdate(
    { candidate: req.user.id, actionType, jobSignature: signature },
    {
      candidate: req.user.id,
      actionType,
      jobSignature: signature,
      jobId: String(job._id || recommendation?.id || recommendation?.jobId || ''),
      source: recommendation?.source || 'unknown',
      title: job.title || recommendation?.title || '',
      company: job.company || recommendation?.company || '',
      location: job.location || recommendation?.location || '',
      url: job.url || recommendation?.url || job.applicationLink || '',
      salary: job.salary || recommendation?.salary || '',
      matchingScore: Number(recommendation?.matchingScore || 0),
      matchedSkills: recommendation?.matchedSkills || [],
      missingSkills: recommendation?.missingSkills || [],
      actionDate: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json(action);
};

/**
 * GET /api/candidate/job-actions?type=applied|removed
 */
const getJobActions = async (req, res) => {
  const type = req.query.type;
  const filter = { candidate: req.user.id };
  if (['applied', 'removed'].includes(type)) {
    filter.actionType = type;
  }

  const actions = await JobAction.find(filter)
    .sort({ actionDate: -1 })
    .limit(100);

  res.json(actions);
};

/**
 * GET /api/candidate/skill-gap/:jobId
 * Returns the skill gap for a specific job.
 */
const getSkillGap = async (req, res) => {
  const resume = await Resume.findOne({ candidate: req.user.id });
  if (!resume) return res.status(404).json({ message: 'Please upload a resume first' });

  let job = await Job.findById(req.params.jobId).catch(() => null);
  if (!job) {
    job = await ScrapedJob.findById(req.params.jobId).catch(() => null);
  }
  if (!job) return res.status(404).json({ message: 'Job not found' });

  const { matchingScore, matchedSkills, missingSkills } = calculateMatchEnhanced(resume, job);

  res.json({
    job: { _id: job._id, title: job.title, company: job.company },
    candidateSkills: resume.skills,
    requiredSkills: job.requiredSkills,
    matchedSkills,
    missingSkills,
    matchingScore,
  });
};

/**
 * GET /api/recruiter/candidates  (recruiter only)
 * Returns all candidate resumes with their best match score for the recruiter's jobs.
 */
const getCandidatesForRecruiter = async (req, res) => {
  const recruiterJobs = await Job.find({ recruiter: req.user.id }).select('_id');
  const jobIds = recruiterJobs.map((j) => j._id);

  const resumes = await Resume.find().populate('candidate', 'name email');

  const candidateData = await Promise.all(
    resumes.map(async (resume) => {
      const bestMatch = await Match.findOne({
        resume: resume._id,
        job: { $in: jobIds },
      })
        .populate('job', 'title company')
        .sort({ matchingScore: -1 });

      return {
        candidate: resume.candidate,
        resumeId: resume._id,
        skills: resume.skills,
        summary: resume.summary,
        bestMatch: bestMatch
          ? { score: bestMatch.matchingScore, job: bestMatch.job }
          : null,
      };
    }),
  );

  res.json(candidateData);
};

module.exports = {
  matchJobs,
  getRecommendations,
  getCandidateProfile,
  markJobAction,
  getJobActions,
  getSkillGap,
  getCandidatesForRecruiter,
};
