import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const SavedJobs = () => {
  const [scrapedJobs, setScrapedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [error, setError] = useState('');
  const [scrapeResult, setScrapeResult] = useState(null);
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    fetchSavedJobs();
    checkResume();
  }, []);

  const checkResume = async () => {
    try {
      await api.get('/resume/me');
      setHasResume(true);
    } catch {
      setHasResume(false);
    }
  };

  const fetchSavedJobs = async (search = '', location = '') => {
    setLoading(true);
    try {
      const params = { limit: 50, page: 1 };
      if (search) params.search = search;
      if (location) params.location = location;
      const res = await api.get('/jobs/scraped', { params });
      setScrapedJobs(res.data.jobs || []);
    } catch (err) {
      setError('Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!hasResume) {
      setError('Please upload a resume first to discover matching jobs.');
      return;
    }
    setScraping(true);
    setError('');
    setScrapeResult(null);
    try {
      const res = await api.post('/jobs/scrape');
      setScrapeResult({
        message: res.data.message,
        count: res.data.matches?.length || 0,
      });
      // Refresh the list
      await fetchSavedJobs(searchQuery, locationFilter);
    } catch (err) {
      setError(err.response?.data?.message || 'Job discovery failed. Please try again.');
    } finally {
      setScraping(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchSavedJobs(searchQuery, locationFilter);
  };

  const getSourceBadgeColor = (source) => {
    const colors = {
      remoteok: 'bg-purple-100 text-purple-700',
      linkedin: 'bg-blue-100 text-blue-700',
      indeed: 'bg-orange-100 text-orange-700',
      naukri: 'bg-amber-100 text-amber-700',
      themuse: 'bg-violet-100 text-violet-700',
      default: 'bg-gray-100 text-gray-700',
    };
    return colors[source] || colors.default;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Discovered Jobs</h1>
            <p className="text-gray-500 mt-1">Jobs discovered from external sources matching your profile</p>
          </div>
          <button
            onClick={handleDiscover}
            disabled={scraping}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all ${
              scraping
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md'
            }`}
          >
            {scraping ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Discovering...
              </>
            ) : (
              <>
                <span>🔍</span>
                Discover New Jobs
              </>
            )}
          </button>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {scrapeResult && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <span>✅</span> {scrapeResult.message} ({scrapeResult.count} matches found)
          </div>
        )}

        {!hasResume && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <span>ℹ️</span>
            <span>
              <Link to="/upload" className="font-medium underline">Upload your resume</Link> to enable AI-powered job discovery.
            </span>
          </div>
        )}

        {/* Search & Filter */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 premium-card">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search by title, company, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="sm:w-48 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📍</span>
              <input
                type="text"
                placeholder="Location..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
            >
              Filter
            </button>
          </div>
        </form>

        {/* Jobs Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading jobs...</p>
            </div>
          </div>
        ) : scrapedJobs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center premium-card">
            <div className="text-6xl mb-4">🌐</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Jobs Discovered Yet</h3>
            <p className="text-gray-400 mb-6">
              Click "Discover New Jobs" to fetch real-time job listings matching your resume skills.
            </p>
            <button
              onClick={handleDiscover}
              disabled={scraping || !hasResume}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>🔍</span>
              {!hasResume ? 'Upload Resume First' : 'Start Job Discovery'}
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">{scrapedJobs.length} job{scrapedJobs.length !== 1 ? 's' : ''} found</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {scrapedJobs.map((job) => (
                <div key={job._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col premium-card">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
                      <p className="text-gray-500 text-sm truncate">{job.company || 'Company not listed'}</p>
                    </div>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getSourceBadgeColor(job.source)}`}>
                      {job.source}
                    </span>
                  </div>

                  {/* Location & Salary */}
                  <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <span>📍</span>{job.location}
                      </span>
                    )}
                    {job.salary && (
                      <span className="flex items-center gap-1">
                        <span>💰</span>{job.salary}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {job.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-1">
                      {job.description.substring(0, 150)}...
                    </p>
                  )}

                  {/* Skills */}
                  {job.requiredSkills && job.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {job.requiredSkills.slice(0, 5).map((skill, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                      {job.requiredSkills.length > 5 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
                          +{job.requiredSkills.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                    <span className="text-gray-400 text-xs">{formatDate(job.scrapedAt || job.createdAt)}</span>
                    {job.url ? (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        Apply <span>→</span>
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">No link</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SavedJobs;
