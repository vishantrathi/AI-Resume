const { calculateMatch, normaliseSkill, tokenOverlapScore } = require('../utils/matcher');

describe('Matcher Utility', () => {
  describe('normaliseSkill', () => {
    it('should map alias to canonical form', () => {
      expect(normaliseSkill('nodejs')).toBe('node');
      expect(normaliseSkill('reactjs')).toBe('react');
      expect(normaliseSkill('postgres')).toBe('postgres');
    });

    it('should return the skill as-is when no alias exists', () => {
      expect(normaliseSkill('python')).toBe('python');
    });
  });

  describe('tokenOverlapScore', () => {
    it('should return 1 for identical texts', () => {
      const score = tokenOverlapScore('javascript react nodejs', 'javascript react nodejs');
      expect(score).toBeCloseTo(1, 2);
    });

    it('should return 0 for completely different texts', () => {
      const score = tokenOverlapScore('javascript react', 'python django');
      expect(score).toBe(0);
    });

    it('should return partial score for overlapping texts', () => {
      const score = tokenOverlapScore('javascript react nodejs', 'javascript python mongodb');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });

  describe('calculateMatch', () => {
    const resume = {
      skills: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS'],
      rawText: 'Experienced JavaScript React developer with Node.js HTML CSS knowledge',
    };

    it('should return a high score when skills overlap significantly', () => {
      const job = {
        requiredSkills: ['JavaScript', 'React', 'Node.js'],
        description: 'Looking for a React and Node.js developer',
      };
      const result = calculateMatch(resume, job);
      expect(result.matchingScore).toBeGreaterThanOrEqual(80);
      expect(result.matchedSkills.length).toBeGreaterThan(0);
      expect(result.missingSkills.length).toBe(0);
    });

    it('should identify missing skills', () => {
      const job = {
        requiredSkills: ['JavaScript', 'React', 'MongoDB', 'Python'],
        description: 'Full-stack developer needed',
      };
      const result = calculateMatch(resume, job);
      const missingLower = result.missingSkills.map(s => s.toLowerCase());
      expect(missingLower).toContain('mongodb');
      expect(missingLower).toContain('python');
    });

    it('should return 0 score when no skills match', () => {
      const job = {
        requiredSkills: ['Rust', 'Haskell', 'Erlang'],
        description: 'Systems programming languages needed',
      };
      const result = calculateMatch(resume, job);
      expect(result.matchingScore).toBeLessThanOrEqual(20);
    });

    it('should handle empty job skills by falling back to text overlap', () => {
      const job = {
        requiredSkills: [],
        description: 'JavaScript developer needed',
      };
      const result = calculateMatch(resume, job);
      expect(result).toHaveProperty('matchingScore');
      expect(result).toHaveProperty('matchedSkills');
      expect(result).toHaveProperty('missingSkills');
    });

    it('should not exceed 100 for matching score', () => {
      const job = {
        requiredSkills: ['JavaScript', 'React'],
        description: 'JavaScript React developer',
      };
      const result = calculateMatch(resume, job);
      expect(result.matchingScore).toBeLessThanOrEqual(100);
    });

    it('should handle alias matching (nodejs == node)', () => {
      const resumeWithAlias = {
        skills: ['nodejs'],
        rawText: 'nodejs developer',
      };
      const job = {
        requiredSkills: ['node'],
        description: 'node developer needed',
      };
      const result = calculateMatch(resumeWithAlias, job);
      expect(result.matchingScore).toBeGreaterThan(0);
    });
  });
});
