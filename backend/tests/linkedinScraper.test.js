const {
  extractLinkedInJobsFromHtml,
  buildLinkedInSearchUrl,
  normaliseLinkedInJobLink,
} = require('../services/jobScraper');

describe('LinkedIn scraper helpers', () => {
  it('buildLinkedInSearchUrl should include query, location and pagination start', () => {
    const url = buildLinkedInSearchUrl(['react', 'node'], 25, 'Bangalore');
    expect(url).toContain('https://www.linkedin.com/jobs/search/?');
    expect(url).toContain('keywords=react%20node');
    expect(url).toContain('location=Bangalore');
    expect(url).toContain('start=25');
  });

  it('normaliseLinkedInJobLink should convert relative URLs to absolute LinkedIn URLs', () => {
    expect(normaliseLinkedInJobLink('/jobs/view/123')).toBe('https://www.linkedin.com/jobs/view/123');
    expect(normaliseLinkedInJobLink('https://www.linkedin.com/jobs/view/123')).toBe('https://www.linkedin.com/jobs/view/123');
  });

  it('extractLinkedInJobsFromHtml should parse public LinkedIn job cards', () => {
    const html = `
      <div class="base-search-card">
        <a class="base-card__full-link" href="/jobs/view/123"></a>
        <h3 class="base-search-card__title">Senior React Developer</h3>
        <h4 class="base-search-card__subtitle"><a>Acme Corp</a></h4>
        <span class="job-search-card__location">Bangalore, Karnataka</span>
        <time class="job-search-card__listdate">2 days ago</time>
      </div>
      <div class="base-search-card">
        <a class="base-card__full-link" href="/jobs/view/456"></a>
        <h3 class="base-search-card__title">Backend Engineer</h3>
        <h4 class="base-search-card__subtitle"><a>Beta Labs</a></h4>
        <span class="job-search-card__location">Remote</span>
      </div>
    `;

    const jobs = extractLinkedInJobsFromHtml(html);
    expect(jobs.length).toBe(2);
    expect(jobs[0].title).toBe('Senior React Developer');
    expect(jobs[0].company).toBe('Acme Corp');
    expect(jobs[0].url).toBe('https://www.linkedin.com/jobs/view/123');
    expect(jobs[0].source).toBe('linkedin');
  });
});
