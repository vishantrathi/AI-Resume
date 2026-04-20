const {
  extractLinksFromHtml,
  looksLikeJobLink,
  normaliseUrl,
} = require('../services/webCrawler');

describe('webCrawler helpers', () => {
  it('normaliseUrl should resolve relative URLs', () => {
    const out = normaliseUrl('/jobs/view/123', 'https://www.linkedin.com/jobs');
    expect(out).toBe('https://www.linkedin.com/jobs/view/123');
  });

  it('looksLikeJobLink should detect common job URL patterns', () => {
    expect(looksLikeJobLink('https://boards.greenhouse.io/acme/jobs/123')).toBe(true);
    expect(looksLikeJobLink('https://example.com/about')).toBe(false);
  });

  it('extractLinksFromHtml should keep only allowed-host job-like links', () => {
    const html = `
      <a href="/jobs/view/1">Engineer Role</a>
      <a href="https://www.linkedin.com/jobs/view/2">Open Job</a>
      <a href="https://example.com/about">About</a>
    `;
    const allowed = new Set(['www.linkedin.com']);
    const out = extractLinksFromHtml(html, 'https://www.linkedin.com/jobs', allowed);

    expect(out).toContain('https://www.linkedin.com/jobs/view/1');
    expect(out).toContain('https://www.linkedin.com/jobs/view/2');
    expect(out.some((u) => u.includes('example.com'))).toBe(false);
  });
});
