import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const JobList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/jobs');
        setJobs(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load jobs');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = jobs.filter((j) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.location?.toLowerCase().includes(q);
  });

  if (loading) return <div className="loading">Loading jobs...</div>;

  return (
    <div className="page-container">
      <h1>💼 All Jobs</h1>
      <p className="page-subtitle">{jobs.length} job{jobs.length !== 1 ? 's' : ''} available</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by title, company, or location..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>No jobs found matching your search.</p>
        </div>
      ) : (
        <div className="job-list-grid">
          {filtered.map((job) => (
            <div key={job._id} className="job-list-card">
              <div className="job-list-header">
                <div>
                  <h2>{job.title}</h2>
                  <p className="company">🏢 {job.company}</p>
                  {job.location && <p className="location">📍 {job.location}</p>}
                </div>
              </div>
              <p className="job-description-preview">
                {job.description.substring(0, 200)}{job.description.length > 200 ? '...' : ''}
              </p>
              <div className="skill-badges mt-1">
                {job.requiredSkills.slice(0, 6).map((s) => (
                  <span key={s} className="badge badge-skill">{s}</span>
                ))}
                {job.requiredSkills.length > 6 && (
                  <span className="badge badge-more">+{job.requiredSkills.length - 6}</span>
                )}
              </div>
              <div className="job-list-footer">
                {job.experience && <span className="meta">⏱ {job.experience}</span>}
                {job.education && <span className="meta">🎓 {job.education}</span>}
                {job.applicationLink && (
                  <a href={job.applicationLink} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                    Apply Now ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2">
        <Link to="/dashboard" className="btn-outline">← Back to Dashboard</Link>
      </div>
    </div>
  );
};

export default JobList;
