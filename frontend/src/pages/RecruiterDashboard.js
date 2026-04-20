import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const RecruiterDashboard = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('jobs');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, candidatesRes] = await Promise.all([
          api.get('/jobs/recruiter/mine'),
          api.get('/candidate/recruiter/candidates'),
        ]);
        setJobs(jobsRes.data);
        setCandidates(candidatesRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete job');
    }
  };

  if (loading) return <div className="loading">Loading recruiter dashboard...</div>;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <h1>Recruiter Dashboard 🏢</h1>
        <p className="page-subtitle">Welcome, {user.name}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{jobs.length}</span>
          <span className="stat-label">Active Jobs</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{candidates.length}</span>
          <span className="stat-label">Total Candidates</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">
            {candidates.filter((c) => c.bestMatch && c.bestMatch.score >= 70).length}
          </span>
          <span className="stat-label">Strong Matches (≥70%)</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          My Jobs ({jobs.length})
        </button>
        <button
          className={`tab ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          Candidates ({candidates.length})
        </button>
      </div>

      {activeTab === 'jobs' && (
        <div>
          <div className="section-header">
            <h2>Posted Jobs</h2>
            <Link to="/post-job" className="btn-primary">+ Post New Job</Link>
          </div>
          {jobs.length === 0 ? (
            <div className="empty-state">
              <p>No jobs posted yet.</p>
              <Link to="/post-job" className="btn-primary">Post Your First Job</Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Required Skills</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job._id}>
                      <td><strong>{job.title}</strong></td>
                      <td>{job.company}</td>
                      <td>
                        <div className="skill-badges-inline">
                          {job.requiredSkills.slice(0, 4).map((s) => (
                            <span key={s} className="badge badge-skill badge-sm">{s}</span>
                          ))}
                          {job.requiredSkills.length > 4 && (
                            <span className="badge badge-more badge-sm">+{job.requiredSkills.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${job.isActive ? 'active' : 'inactive'}`}>
                          {job.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => handleDeleteJob(job._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'candidates' && (
        <div>
          <h2>Candidate Profiles</h2>
          {candidates.length === 0 ? (
            <div className="empty-state">
              <p>No candidates have uploaded resumes yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Top Skills</th>
                    <th>Best Match</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates
                    .sort((a, b) => (b.bestMatch?.score || 0) - (a.bestMatch?.score || 0))
                    .map((c) => (
                      <tr key={c.resumeId}>
                        <td><strong>{c.candidate?.name}</strong></td>
                        <td>{c.candidate?.email}</td>
                        <td>
                          <div className="skill-badges-inline">
                            {(c.skills || []).slice(0, 3).map((s) => (
                              <span key={s} className="badge badge-skill badge-sm">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td>{c.bestMatch ? `${c.bestMatch.job?.title} @ ${c.bestMatch.job?.company}` : '—'}</td>
                        <td>
                          {c.bestMatch ? (
                            <span
                              className="score-badge-inline"
                              style={{
                                color: c.bestMatch.score >= 70 ? '#10b981' : c.bestMatch.score >= 40 ? '#f59e0b' : '#ef4444',
                              }}
                            >
                              {c.bestMatch.score}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecruiterDashboard;
