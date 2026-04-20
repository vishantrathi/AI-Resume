const { calculateMatchEnhanced } = require('../utils/matcher');
const {
  getCached, setCache, generateFallbackJobs, normalizeAndMatch, _cache,
} = require('../services/jobScraper');

// ─── calculateMatchEnhanced ───────────────────────────────────────────────────
describe('calculateMatchEnhanced', () => {
  const resume = {
    skills: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS'],
    rawText: 'Experienced JavaScript React developer with Node.js HTML CSS knowledge',
    experience: [{ duration: '2 years' }],
  };

  it('should return a score > 50 when skills overlap significantly', () => {
    const job = {
      title: 'React Developer',
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      description: 'Looking for a React and Node.js developer',
    };
    const result = calculateMatchEnhanced(resume, job);
    expect(result.matchingScore).toBeGreaterThan(50);
    expect(result.matchedSkills.length).toBeGreaterThan(0);
    expect(result.missingSkills.length).toBe(0);
  });

  it('should identify missing skills', () => {
    const job = {
      title: 'Full Stack Developer',
      requiredSkills: ['JavaScript', 'React', 'MongoDB', 'Python'],
      description: 'Full-stack developer needed',
    };
    const result = calculateMatchEnhanced(resume, job);
    const missingLower = result.missingSkills.map((s) => s.toLowerCase());
    expect(missingLower).toContain('mongodb');
    expect(missingLower).toContain('python');
  });

  it('should return a low score when no skills match', () => {
    const job = {
      title: 'Systems Engineer',
      requiredSkills: ['Rust', 'Haskell', 'Erlang'],
      description: 'Systems programming languages needed',
    };
    const result = calculateMatchEnhanced(resume, job);
    expect(result.matchingScore).toBeLessThanOrEqual(30);
  });

  it('should not exceed 100 for any input', () => {
    const job = {
      title: 'JavaScript React Developer',
      requiredSkills: ['JavaScript', 'React'],
      description: 'JavaScript React developer needed',
    };
    const result = calculateMatchEnhanced(resume, job);
    expect(result.matchingScore).toBeLessThanOrEqual(100);
  });

  it('should handle alias matching (nodejs == node)', () => {
    const aliasResume = { skills: ['nodejs'], rawText: 'nodejs developer' };
    const job = { title: 'Node Developer', requiredSkills: ['node'], description: 'node developer needed' };
    const result = calculateMatchEnhanced(aliasResume, job);
    expect(result.matchingScore).toBeGreaterThan(0);
  });

  it('should handle empty job skills gracefully', () => {
    const job = { title: 'Developer', requiredSkills: [], description: 'JavaScript developer' };
    const result = calculateMatchEnhanced(resume, job);
    expect(result).toHaveProperty('matchingScore');
    expect(result).toHaveProperty('matchedSkills');
    expect(result).toHaveProperty('missingSkills');
  });

  it('should return correct shape', () => {
    const job = {
      title: 'Software Engineer',
      requiredSkills: ['JavaScript'],
      description: 'JS developer',
    };
    const result = calculateMatchEnhanced(resume, job);
    expect(typeof result.matchingScore).toBe('number');
    expect(Array.isArray(result.matchedSkills)).toBe(true);
    expect(Array.isArray(result.missingSkills)).toBe(true);
  });
});

// ─── jobScraper service ───────────────────────────────────────────────────────
describe('jobScraper service', () => {
  beforeEach(() => {
    _cache.clear();
  });

  describe('getCached / setCache', () => {
    it('should store and retrieve a value', () => {
      setCache('k', [1, 2, 3]);
      expect(getCached('k')).toEqual([1, 2, 3]);
    });

    it('should return null for missing key', () => {
      expect(getCached('no-such-key')).toBeNull();
    });

    it('should expire entries after TTL', () => {
      // Set TTL to 1ms in the past by writing the internal entry directly
      _cache.set('expired', { data: 'stale', expiresAt: Date.now() - 1 });
      expect(getCached('expired')).toBeNull();
    });
  });

  describe('generateFallbackJobs', () => {
    it('should return empty array because synthetic jobs are disabled', () => {
      expect(generateFallbackJobs([])).toEqual([]);
      expect(generateFallbackJobs(['JavaScript', 'React', 'Node.js'])).toEqual([]);
    });
  });

  describe('normalizeAndMatch', () => {
    const resume = {
      skills: ['JavaScript', 'React'],
      rawText: 'JavaScript React developer',
    };

    it('should return the correct shape', () => {
      const raw = {
        title: 'Frontend Dev',
        company: 'TechCo',
        requiredSkills: ['JavaScript', 'React'],
        description: 'React developer role',
        url: 'http://example.com',
        externalId: 'ext-1',
      };
      const result = normalizeAndMatch(raw, resume, 'test-source');
      expect(result).toHaveProperty('job');
      expect(result).toHaveProperty('match');
      // source should now reflect the actual portal label passed as the third argument
      expect(result).toHaveProperty('source', 'test-source');
      expect(result.match).toHaveProperty('matchingScore');
      expect(result.match).toHaveProperty('matchedSkills');
      expect(result.match).toHaveProperty('missingSkills');
    });

    it('should compute a positive match score for matching skills', () => {
      const raw = {
        title: 'JS Developer',
        company: 'Corp',
        requiredSkills: ['JavaScript', 'React'],
        description: 'JS React dev',
        url: '',
        externalId: 'ext-2',
      };
      const result = normalizeAndMatch(raw, resume, 'src');
      expect(result.match.matchingScore).toBeGreaterThan(0);
    });

    it('should handle missing fields gracefully', () => {
      const raw = {};
      const result = normalizeAndMatch(raw, resume, 'src');
      expect(result.job.title).toBe('Software Engineer');
      expect(result.job.location).toBe('Remote');
    });
  });
});
