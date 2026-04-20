/**
 * Semantic Matching Utility
 *
 * Calculates a matching score between candidate skills and job required skills
 * using TF-IDF-inspired term frequency overlap combined with synonym/alias awareness.
 *
 * calculateMatch          — original algorithm (preserved for backward compatibility)
 * calculateMatchEnhanced  — improved weighted scoring:
 *   50% skill match · 20% title similarity · 15% experience match · 15% NLP text similarity
 */

const { extractSkills, tokenize, removeStopWords } = require('./nlpProcessor');

let stringSimilarity;
try {
  stringSimilarity = require('string-similarity');
} catch (_) {
  stringSimilarity = null;
}

// Alias groups — skills in the same group are considered equivalent
const ALIAS_GROUPS = [
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['node', 'nodejs', 'node.js'],
  ['react', 'reactjs', 'react.js'],
  ['angular', 'angularjs'],
  ['vue', 'vuejs'],
  ['express', 'expressjs', 'express.js'],
  ['postgres', 'postgresql'],
  ['python', 'py'],
  ['golang', 'go'],
  ['kubernetes', 'k8s'],
  ['mongodb', 'mongo'],
  ['machine learning', 'ml'],
  ['natural language processing', 'nlp'],
  ['rest', 'restful', 'rest api'],
  ['next.js', 'nextjs'],
  ['nest.js', 'nestjs'],
  ['ci/cd', 'cicd'],
  ['spring boot', 'springboot'],
  ['react native', 'reactnative'],
  ['scikit-learn', 'sklearn'],
];

/**
 * Build a map from every alias to the canonical form (first in list).
 */
function buildAliasMap() {
  const map = new Map();
  for (const group of ALIAS_GROUPS) {
    const canonical = group[0];
    for (const alias of group) {
      map.set(alias.toLowerCase(), canonical.toLowerCase());
    }
  }
  return map;
}

const ALIAS_MAP = buildAliasMap();

/**
 * Normalise a skill string using the alias map.
 * @param {string} skill
 * @returns {string}
 */
function normaliseSkill(skill) {
  const lower = skill.toLowerCase();
  return ALIAS_MAP.get(lower) || lower;
}

/**
 * Normalise an array of skill strings.
 * @param {string[]} skills
 * @returns {Set<string>}
 */
function normaliseSkills(skills) {
  return new Set(skills.map(normaliseSkill));
}

/**
 * Compute TF-IDF-inspired token overlap score between two text bodies.
 * Used as a secondary signal when explicit skill lists are sparse.
 * @param {string} textA
 * @param {string} textB
 * @returns {number} score between 0 and 1
 */
function tokenOverlapScore(textA, textB) {
  const tokensA = new Set(removeStopWords(tokenize(textA)));
  const tokensB = new Set(removeStopWords(tokenize(textB)));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  // Jaccard similarity
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate the matching score between a candidate's resume and a job description.
 *
 * @param {object} resume  - { skills: string[], rawText: string }
 * @param {object} job     - { requiredSkills: string[], description: string }
 * @returns {{ matchingScore: number, matchedSkills: string[], missingSkills: string[] }}
 */
function calculateMatch(resume, job) {
  const candidateSkills = normaliseSkills(resume.skills || []);
  const jobSkills = normaliseSkills(job.requiredSkills || []);

  // If neither side has explicit skills, fall back to token overlap
  if (jobSkills.size === 0) {
    const candidateText = resume.rawText || resume.skills.join(' ');
    const jobText = job.description || '';
    const overlap = tokenOverlapScore(candidateText, jobText);
    // Extract skills from job description on-the-fly
    const derivedJobSkills = normaliseSkills(extractSkills(jobText));
    const derivedCandidateSkills = normaliseSkills(resume.skills || []);
    const matched = [...derivedJobSkills].filter((s) => derivedCandidateSkills.has(s));
    const missing = [...derivedJobSkills].filter((s) => !derivedCandidateSkills.has(s));
    const score = Math.round(overlap * 100);
    return { matchingScore: score, matchedSkills: matched, missingSkills: missing };
  }

  const matched = [...jobSkills].filter((s) => candidateSkills.has(s));
  const missing = [...jobSkills].filter((s) => !candidateSkills.has(s));

  // Core score: percentage of required skills that the candidate has
  const skillScore = jobSkills.size > 0 ? matched.length / jobSkills.size : 0;

  // Bonus: token-level text similarity (weighted at 20%)
  const candidateText = (resume.rawText || '') + ' ' + (resume.skills || []).join(' ');
  const jobText = (job.description || '') + ' ' + (job.requiredSkills || []).join(' ');
  const textBonus = tokenOverlapScore(candidateText, jobText);

  const finalScore = Math.round((skillScore * 0.8 + textBonus * 0.2) * 100);

  return {
    matchingScore: Math.min(finalScore, 100),
    matchedSkills: matched.map(capitalise),
    missingSkills: missing.map(capitalise),
  };
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Enhanced matching algorithm ─────────────────────────────────────────────

/**
 * Compute title similarity between a candidate's resume text and a job title.
 * Uses string-similarity (Dice coefficient) when available, else token overlap.
 *
 * @param {string} resumeText
 * @param {string} jobTitle
 * @returns {number} 0–1
 */
function titleSimilarity(resumeText, jobTitle) {
  if (!resumeText || !jobTitle) return 0;
  if (stringSimilarity) {
    return stringSimilarity.compareTwoStrings(
      resumeText.toLowerCase().substring(0, 500),
      jobTitle.toLowerCase(),
    );
  }
  return tokenOverlapScore(resumeText, jobTitle);
}

/**
 * Estimate experience match as a ratio of candidate experience years to job requirement.
 *
 * @param {object[]} resumeExperience - Array of experience entries with { duration } strings
 * @param {string}   jobDescription   - Full job description text
 * @returns {number} 0–1
 */
function experienceMatch(resumeExperience, jobDescription) {
  const jobText = jobDescription || '';

  // Extract years required from job description (e.g. "3+ years", "2-5 years")
  const reqMatch = jobText.match(/(\d+)\s*[\-–]\s*(\d+)\s*years?/i)
    || jobText.match(/(\d+)\+?\s*years?/i);

  let requiredYears = 0;
  if (reqMatch) {
    requiredYears = parseInt(reqMatch[1], 10);
    if (reqMatch[2]) {
      requiredYears = Math.round((parseInt(reqMatch[1], 10) + parseInt(reqMatch[2], 10)) / 2);
    }
  }

  if (requiredYears === 0) return 0.5; // No requirement stated — neutral

  // Estimate candidate's experience from experience array
  let candidateYears = 0;
  if (Array.isArray(resumeExperience) && resumeExperience.length > 0) {
    candidateYears = resumeExperience.length; // Approximate: one entry ≈ one year
    for (const exp of resumeExperience) {
      const dur = (exp.duration || exp.years || '').toString();
      const yMatch = dur.match(/(\d+)\s*year/i);
      if (yMatch) candidateYears = Math.max(candidateYears, parseInt(yMatch[1], 10));
    }
  }

  if (candidateYears === 0) return 0.3; // No experience data

  return Math.min(candidateYears / requiredYears, 1);
}

/**
 * Improved match algorithm using weighted scoring:
 *   50% skill match
 *   20% title similarity
 *   15% experience match
 *   15% NLP / keyword text similarity
 *
 * The result shape is identical to calculateMatch so it can be used as a
 * drop-in replacement.
 *
 * @param {object} resume - { skills, rawText, experience? }
 * @param {object} job    - { requiredSkills, description, title? }
 * @returns {{ matchingScore, matchedSkills, missingSkills }}
 */
function calculateMatchEnhanced(resume, job) {
  const candidateSkills = normaliseSkills(resume.skills || []);
  const jobSkills = normaliseSkills(job.requiredSkills || []);

  // ── 1. Skill match (50%) ──────────────────────────────────────────────────
  let skillRatio = 0;
  let matched = [];
  let missing = [];

  if (jobSkills.size === 0) {
    // Fall back to text-derived skills when job has no explicit skill list
    const derivedJobSkills = normaliseSkills(extractSkills(job.description || ''));
    matched = [...derivedJobSkills].filter((s) => candidateSkills.has(s));
    missing = [...derivedJobSkills].filter((s) => !candidateSkills.has(s));
    skillRatio = derivedJobSkills.size > 0 ? matched.length / derivedJobSkills.size : 0;
  } else {
    matched = [...jobSkills].filter((s) => candidateSkills.has(s));
    missing = [...jobSkills].filter((s) => !candidateSkills.has(s));
    skillRatio = matched.length / jobSkills.size;
  }

  // ── 2. Title similarity (20%) ────────────────────────────────────────────
  const titleScore = titleSimilarity(resume.rawText || '', job.title || '');

  // ── 3. Experience match (15%) ────────────────────────────────────────────
  const expScore = experienceMatch(resume.experience || [], job.description || '');

  // ── 4. NLP text similarity (15%) ─────────────────────────────────────────
  const candidateText = (resume.rawText || '') + ' ' + (resume.skills || []).join(' ');
  const jobText = (job.description || '') + ' ' + (job.requiredSkills || []).join(' ');
  const nlpScore = tokenOverlapScore(candidateText, jobText);

  // ── Weighted final score ─────────────────────────────────────────────────
  const rawScore = (skillRatio * 0.50)
    + (titleScore * 0.20)
    + (expScore * 0.15)
    + (nlpScore * 0.15);

  return {
    matchingScore: Math.min(Math.round(rawScore * 100), 100),
    matchedSkills: matched.map(capitalise),
    missingSkills: missing.map(capitalise),
  };
}

module.exports = {
  calculateMatch,
  calculateMatchEnhanced,
  normaliseSkill,
  normaliseSkills,
  tokenOverlapScore,
};
