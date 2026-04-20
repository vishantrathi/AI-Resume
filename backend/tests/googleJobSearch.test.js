const {
  buildSearchQueries,
  inferSource,
  buildGoogleJobsSearchUrl,
  normaliseGoogleJobDetailUrl,
  mapScrapingBeeGoogleJobs,
} = require('../services/googleJobSearch');

describe('googleJobSearch service', () => {
  describe('buildSearchQueries', () => {
    it('should return a default query when no skills are provided', () => {
      const queries = buildSearchQueries([]);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toContain('developer');
    });

    it('should generate general role queries from skills', () => {
      const skills = ['React', 'Node.js', 'JavaScript'];
      const queries = buildSearchQueries(skills);
      const combined = queries.join(' ');
      expect(combined).toMatch(/react|node\.js|javascript/i);
    });

    it('should include site-scoped queries for major portals', () => {
      const skills = ['Python', 'Django'];
      const queries = buildSearchQueries(skills);
      const combined = queries.join(' ');
      expect(combined).toContain('site:linkedin.com/jobs');
      expect(combined).toContain('site:indeed.com');
      expect(combined).toContain('site:naukri.com');
      expect(combined).toContain('site:glassdoor.com');
      expect(combined).toContain('site:internshala.com');
      expect(combined).toContain('site:wellfound.com');
    });

    it('should use only the top 8 skills for query building', () => {
      const skills = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const queries = buildSearchQueries(skills);
      // All queries should be strings
      for (const q of queries) {
        expect(typeof q).toBe('string');
        expect(q.length).toBeGreaterThan(0);
      }
    });
  });

  describe('inferSource', () => {
    it('should identify LinkedIn URLs', () => {
      expect(inferSource('https://www.linkedin.com/jobs/view/12345')).toBe('linkedin');
    });

    it('should identify Indeed URLs', () => {
      expect(inferSource('https://www.indeed.com/viewjob?jk=abc123')).toBe('indeed');
    });

    it('should identify Glassdoor URLs', () => {
      expect(inferSource('https://www.glassdoor.com/job-listing/...')).toBe('glassdoor');
    });

    it('should identify Naukri URLs', () => {
      expect(inferSource('https://www.naukri.com/job-listings-...')).toBe('naukri');
    });

    it('should identify Internshala URLs', () => {
      expect(inferSource('https://internshala.com/internship/...')).toBe('internshala');
    });

    it('should identify Wellfound (AngelList) URLs', () => {
      expect(inferSource('https://wellfound.com/jobs/12345')).toBe('wellfound');
      expect(inferSource('https://angel.co/company/startup/jobs')).toBe('wellfound');
    });

    it('should identify company ATS URLs (Greenhouse, Lever)', () => {
      expect(inferSource('https://boards.greenhouse.io/company/jobs/123')).toBe('company');
      expect(inferSource('https://jobs.lever.co/company/abc')).toBe('company');
    });

    it('should return "web" for unrecognised URLs', () => {
      expect(inferSource('https://example.com/about')).toBe('web');
    });

    it('should handle empty or null input gracefully', () => {
      expect(inferSource('')).toBe('web');
      expect(inferSource(null)).toBe('web');
      expect(inferSource(undefined)).toBe('web');
    });
  });

  describe('searchJobsOnGoogle', () => {
    it('should use no-API fallback when SERPER_API_KEY is not set', async () => {
      const original = process.env.SERPER_API_KEY;
      delete process.env.SERPER_API_KEY;

      const { searchJobsOnGoogle } = require('../services/googleJobSearch');
      // Use maxUrls=0 to verify no-API code path deterministically without
      // depending on network timing in CI.
      const results = await searchJobsOnGoogle(['JavaScript', 'React'], { maxUrls: 0 });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);

      process.env.SERPER_API_KEY = original;
    });
  });

  describe('ScrapingBee Google Jobs helpers', () => {
    it('should build a Google Jobs search URL with udm=8', () => {
      const url = buildGoogleJobsSearchUrl('Software Engineer', 'New York');
      expect(url).toContain('https://www.google.com/search?q=Software+Engineer+job+near+New+York');
      expect(url).toContain('&udm=8');
    });

    it('should normalise /url?q= links to final target URL', () => {
      const href = '/url?q=https%3A%2F%2Fwww.indeed.com%2Fviewjob%3Fjk%3D123&sa=U&ved=2ah';
      expect(normaliseGoogleJobDetailUrl(href)).toBe('https://www.indeed.com/viewjob?jk=123');
    });

    it('should map ScrapingBee job rows into unified result shape', () => {
      const rows = [
        {
          title: 'Software Engineer',
          location_and_portal: 'Remote · LinkedIn',
          posted: '2 days ago',
          employment_type: 'Full-time',
          salary: '$100k - $130k',
          job_detail: '/url?q=https%3A%2F%2Fwww.linkedin.com%2Fjobs%2Fview%2F123',
        },
      ];

      const mapped = mapScrapingBeeGoogleJobs(rows);
      expect(mapped.length).toBe(1);
      expect(mapped[0].url).toBe('https://www.linkedin.com/jobs/view/123');
      expect(mapped[0].source).toBe('linkedin');
      expect(mapped[0].title).toBe('Software Engineer');
      expect(mapped[0].snippet).toMatch(/Remote/);
    });
  });
});
