import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const PostJob = () => {
  const [form, setForm] = useState({
    title: '',
    company: '',
    description: '',
    requiredSkills: '',
    experience: '',
    education: '',
    location: '',
    applicationLink: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        requiredSkills: form.requiredSkills
          ? form.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      await api.post('/jobs', payload);
      setSuccess(true);
      setTimeout(() => navigate('/recruiter'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container narrow">
      <h1>Post a New Job</h1>
      <p className="page-subtitle">Fill in the details below. Skills will be auto-extracted from the description if not specified.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">✅ Job posted successfully! Redirecting...</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-row">
          <div className="form-group">
            <label>Job Title *</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Backend Developer"
              required
            />
          </div>
          <div className="form-group">
            <label>Company Name *</label>
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={handleChange}
              placeholder="e.g. Tech Corp"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Job Description *</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={6}
            placeholder="Describe the role, responsibilities, and requirements..."
            required
          />
        </div>

        <div className="form-group">
          <label>Required Skills <span className="hint">(comma-separated, or leave blank to auto-extract)</span></label>
          <input
            type="text"
            name="requiredSkills"
            value={form.requiredSkills}
            onChange={handleChange}
            placeholder="e.g. JavaScript, React, Node.js, MongoDB"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Experience Required</label>
            <input
              type="text"
              name="experience"
              value={form.experience}
              onChange={handleChange}
              placeholder="e.g. 2+ years"
            />
          </div>
          <div className="form-group">
            <label>Education</label>
            <input
              type="text"
              name="education"
              value={form.education}
              onChange={handleChange}
              placeholder="e.g. B.Sc Computer Science"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g. Remote, New York"
            />
          </div>
          <div className="form-group">
            <label>Application Link</label>
            <input
              type="url"
              name="applicationLink"
              value={form.applicationLink}
              onChange={handleChange}
              placeholder="https://..."
            />
          </div>
        </div>

        <button type="submit" className="btn-primary btn-full" disabled={loading}>
          {loading ? 'Posting...' : 'Post Job'}
        </button>
      </form>
    </div>
  );
};

export default PostJob;
