const {
  extractIndeedJobsFromHtml,
  buildIndeedSearchUrl,
  normaliseIndeedJobLink,
} = require('../services/jobScraper');

describe('Indeed scraper helpers', () => {
  it('buildIndeedSearchUrl should include query, location and pagination start', () => {
    const url = buildIndeedSearchUrl(['react', 'node'], 20, 'New York');
    expect(url).toContain('https://www.indeed.com/jobs?');
    expect(url).toContain('q=react%20node');
    expect(url).toContain('l=New%20York');
    expect(url).toContain('start=20');
  });

  it('normaliseIndeedJobLink should convert relative URLs to absolute Indeed URLs', () => {
    expect(normaliseIndeedJobLink('/viewjob?jk=abc123')).toBe('https://www.indeed.com/viewjob?jk=abc123');
    expect(normaliseIndeedJobLink('https://www.indeed.com/viewjob?jk=abc123')).toBe('https://www.indeed.com/viewjob?jk=abc123');
  });

  it('extractIndeedJobsFromHtml should parse job cards from Indeed search HTML', () => {
    const html = `
      <div class="job_seen_beacon">
        <h2 class="jobTitle"><a href="/viewjob?jk=abc123"><span>Senior React Developer</span></a></h2>
        <span data-testid="company-name">Acme Corp</span>
        <div data-testid="text-location">Remote</div>
        <div class="salary-snippet-container">$120,000 - $150,000 a year</div>
        <div class="job-snippet">Build modern React and Node.js applications.</div>
      </div>
      <div class="job_seen_beacon">
        <h2 class="jobTitle"><a href="/viewjob?jk=def456"><span>Backend Engineer</span></a></h2>
        <span data-testid="company-name">Beta Labs</span>
        <div data-testid="text-location">New York, NY</div>
        <div class="job-snippet">Python, FastAPI, and PostgreSQL stack.</div>
      </div>
    `;

    const jobs = extractIndeedJobsFromHtml(html);
    expect(jobs.length).toBe(2);
    expect(jobs[0].title).toBe('Senior React Developer');
    expect(jobs[0].company).toBe('Acme Corp');
    expect(jobs[0].location).toBe('Remote');
    expect(jobs[0].url).toBe('https://www.indeed.com/viewjob?jk=abc123');
    expect(jobs[0].requiredSkills.length).toBeGreaterThan(0);
  });
});
