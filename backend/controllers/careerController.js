/**
 * Career Controller
 *
 * Provides two advanced features:
 *  - Skill Gap Analyzer  : GET /api/resume/:id/skill-gap
 *  - Career Roadmap      : GET /api/resume/:id/career-roadmap
 */

const path = require('path');
const Resume = require('../models/Resume');
const Job = require('../models/Job');
const ScrapedJob = require('../models/ScrapedJob');
const Match = require('../models/Match');
const { calculateMatchEnhanced } = require('../utils/matcher');

// Load the static skill hierarchy (difficulty, prerequisites, resources)
const SKILL_HIERARCHY = require('../data/skillHierarchy.json');

// Difficulty sort order – lower numbers come first in the roadmap
const DIFFICULTY_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up a skill in the hierarchy using case-insensitive key matching.
 * Returns the hierarchy entry or null if not found.
 */
function lookupHierarchy(skill) {
  const lower = skill.toLowerCase();
  for (const [key, value] of Object.entries(SKILL_HIERARCHY)) {
    if (key.toLowerCase() === lower) {
      return { key, ...value };
    }
  }
  return null;
}

/**
 * Find the top-matched job for a candidate (from DB matches or all active jobs).
 * Returns the job document or null.
 */
async function resolveTopJob(candidateId, resume) {
  // Try DB matches first
  const topMatch = await Match.findOne({ candidate: candidateId, resume: resume._id })
    .sort({ matchingScore: -1 })
    .populate('job');

  if (topMatch && topMatch.job) return topMatch.job;

  // Fall back to computing against all active DB jobs
  const jobs = await Job.find({ isActive: true });
  if (jobs.length === 0) return null;

  let best = null;
  let bestScore = -1;
  for (const job of jobs) {
    const { matchingScore } = calculateMatchEnhanced(resume, job);
    if (matchingScore > bestScore) {
      bestScore = matchingScore;
      best = job;
    }
  }
  if (best) return best;

  // Last resort: latest scraped job
  return ScrapedJob.findOne({ isActive: true }).sort({ scrapedAt: -1 });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/resume/:id/skill-gap
 *
 * Returns the skill gap between the candidate's resume and their best-matching job.
 *
 * Response:
 * {
 *   matchedSkills: string[],
 *   missingSkills: string[],
 *   skillMatchScore: number   // matched / total job skills * 100
 * }
 */
const getResumeSkillGap = async (req, res) => {
  const resume = await Resume.findById(req.params.id);
  if (!resume) return res.status(404).json({ message: 'Resume not found' });

  // Candidates may only query their own resume
  if (resume.candidate.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Not authorised to view this resume' });
  }

  const topJob = await resolveTopJob(req.user.id, resume);
  if (!topJob) {
    return res.json({ matchedSkills: [], missingSkills: [], skillMatchScore: 0 });
  }

  const { matchedSkills, missingSkills } = calculateMatchEnhanced(resume, topJob);
  const totalJobSkills = (topJob.requiredSkills || []).length;
  const skillMatchScore = totalJobSkills > 0
    ? Math.round((matchedSkills.length / totalJobSkills) * 100)
    : 0;

  return res.json({ matchedSkills, missingSkills, skillMatchScore });
};

/**
 * GET /api/resume/:id/career-roadmap
 *
 * Generates a personalised learning roadmap to bridge the skill gap for
 * the candidate's top-matching job.
 *
 * Response:
 * {
 *   targetRole: string,
 *   roadmap: [
 *     {
 *       step: number,
 *       skill: string,
 *       difficulty: "beginner" | "intermediate" | "advanced",
 *       prerequisites: string[],
 *       resources: { type, title, url }[]
 *     },
 *     ...
 *   ]
 * }
 */
const getCareerRoadmap = async (req, res) => {
  const resume = await Resume.findById(req.params.id);
  if (!resume) return res.status(404).json({ message: 'Resume not found' });

  if (resume.candidate.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Not authorised to view this resume' });
  }

  const topJob = await resolveTopJob(req.user.id, resume);
  const targetRole = topJob ? topJob.title : 'Software Developer';

  // Compute missing skills
  const missingSkills = topJob
    ? calculateMatchEnhanced(resume, topJob).missingSkills
    : [];

  // Enrich each missing skill with hierarchy metadata and sort by difficulty
  const enriched = missingSkills.map((skill) => {
    const entry = lookupHierarchy(skill);
    if (entry) {
      return {
        skill: entry.key,
        difficulty: entry.difficulty || 'intermediate',
        prerequisites: entry.prerequisites || [],
        resources: entry.resources || [],
        difficultyOrder: DIFFICULTY_ORDER[entry.difficulty] || 2,
      };
    }
    return {
      skill,
      difficulty: 'intermediate',
      prerequisites: [],
      resources: [],
      difficultyOrder: 2,
    };
  });

  // Sort by difficulty (beginner → intermediate → advanced), then alphabetically
  enriched.sort((a, b) => {
    if (a.difficultyOrder !== b.difficultyOrder) return a.difficultyOrder - b.difficultyOrder;
    return a.skill.localeCompare(b.skill);
  });

  const roadmap = enriched.map(({ skill, difficulty, prerequisites, resources }, index) => ({
    step: index + 1,
    skill,
    difficulty,
    prerequisites,
    resources,
  }));

  return res.json({ targetRole, roadmap });
};

module.exports = { getResumeSkillGap, getCareerRoadmap };
