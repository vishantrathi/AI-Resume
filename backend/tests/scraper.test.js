const { generateFallbackJobs } = require('../utils/scraper');

describe('Scraper Utility', () => {
  describe('generateFallbackJobs', () => {
    it('should always return empty array because synthetic jobs are disabled', () => {
      expect(generateFallbackJobs([])).toEqual([]);
      expect(generateFallbackJobs(['JavaScript', 'React'])).toEqual([]);
    });
  });
});
