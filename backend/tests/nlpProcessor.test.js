const { tokenize, removeStopWords, extractSkills, parseResume, generateSummary } = require('../utils/nlpProcessor');

describe('NLP Processor', () => {
  describe('tokenize', () => {
    it('should tokenize a sentence into lowercase tokens', () => {
      const tokens = tokenize('Hello World JavaScript');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('javascript');
    });

    it('should return empty array for empty string', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize(null)).toEqual([]);
    });

    it('should strip punctuation', () => {
      const tokens = tokenize('React.js, Node.js!');
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('removeStopWords', () => {
    it('should remove common stop words', () => {
      const tokens = ['i', 'have', 'experience', 'in', 'javascript'];
      const result = removeStopWords(tokens);
      expect(result).not.toContain('i');
      expect(result).not.toContain('in');
      expect(result).toContain('experience');
      expect(result).toContain('javascript');
    });
  });

  describe('extractSkills', () => {
    it('should extract known skills from resume text', () => {
      const text = 'Proficient in JavaScript, React, Node.js and MongoDB. Experience with REST APIs.';
      const skills = extractSkills(text);
      expect(skills.map(s => s.toLowerCase())).toContain('javascript');
      expect(skills.map(s => s.toLowerCase())).toContain('react');
      expect(skills.map(s => s.toLowerCase())).toContain('mongodb');
    });

    it('should return empty array for empty text', () => {
      expect(extractSkills('')).toEqual([]);
      expect(extractSkills(null)).toEqual([]);
    });

    it('should deduplicate skills', () => {
      const text = 'JavaScript JavaScript javascript';
      const skills = extractSkills(text);
      const lowerSkills = skills.map(s => s.toLowerCase());
      expect(lowerSkills.filter(s => s === 'javascript').length).toBe(1);
    });

    it('should extract multi-word skills', () => {
      const text = 'Experience with machine learning and natural language processing';
      const skills = extractSkills(text);
      const lower = skills.map(s => s.toLowerCase());
      expect(lower.some(s => s.includes('machine learning'))).toBe(true);
    });
  });

  describe('parseResume', () => {
    it('should return structured resume data', () => {
      const text = `
John Doe
Summary: Experienced backend developer

Experience
- 3 years at TechCorp building Node.js APIs

Education
- B.Sc Computer Science, XYZ University

Skills: JavaScript, Node.js, MongoDB, REST API
      `;
      const result = parseResume(text);
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('experience');
      expect(result).toHaveProperty('education');
      expect(result).toHaveProperty('certifications');
      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('rawText');
      expect(Array.isArray(result.skills)).toBe(true);
    });

    it('should handle empty text gracefully', () => {
      const result = parseResume('');
      expect(result.skills).toEqual([]);
      expect(result.summary).toBe('');
    });
  });

  describe('generateSummary', () => {
    it('should return the first few meaningful lines', () => {
      const text = 'This is a short line.\nThis is a longer meaningful line that exceeds twenty characters.\nAnother line here for testing purposes only.';
      const summary = generateSummary(text);
      expect(summary.length).toBeGreaterThan(0);
      expect(summary.length).toBeLessThanOrEqual(300);
    });

    it('should return empty string for empty text', () => {
      expect(generateSummary('')).toBe('');
      expect(generateSummary(null)).toBe('');
    });
  });
});
