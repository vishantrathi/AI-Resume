import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const ResumeUpload = () => {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFile = useCallback((f) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|docx|doc)$/i)) {
      setError('Only PDF and DOCX files are allowed');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5 MB');
      return;
    }
    setError('');
    setFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const { data } = await api.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data.resume);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-container">
      <h1>Upload Resume</h1>
      <p className="page-subtitle">Upload your resume in PDF or DOCX format. Our AI will extract your skills and experience automatically.</p>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('file-input').click()}
      >
        <div className="upload-icon">📄</div>
        {file ? (
          <p className="upload-file-name">✅ {file.name}</p>
        ) : (
          <>
            <p>Drag &amp; drop your resume here</p>
            <p className="upload-hint">or click to browse</p>
            <p className="upload-hint">Supported: PDF, DOCX (max 5 MB)</p>
          </>
        )}
        <input
          id="file-input"
          type="file"
          accept=".pdf,.docx,.doc"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {file && !result && (
        <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading & Parsing...' : 'Upload Resume'}
        </button>
      )}

      {result && (
        <div className="parse-result">
          <h2>✅ Resume Parsed Successfully</h2>

          <div className="result-section">
            <h3>📋 Summary</h3>
            <p>{result.summary || 'No summary extracted.'}</p>
          </div>

          <div className="result-section">
            <h3>💡 Extracted Skills ({result.skills.length})</h3>
            <div className="skill-badges">
              {result.skills.length > 0
                ? result.skills.map((s) => <span key={s} className="badge badge-skill">{s}</span>)
                : <span className="muted">No skills extracted</span>}
            </div>
          </div>

          <div className="result-section">
            <h3>💼 Experience</h3>
            {result.experience.length > 0
              ? <ul>{result.experience.map((e, i) => <li key={i}>{e}</li>)}</ul>
              : <p className="muted">No experience lines extracted</p>}
          </div>

          <div className="result-section">
            <h3>🎓 Education</h3>
            {result.education.length > 0
              ? <ul>{result.education.map((e, i) => <li key={i}>{e}</li>)}</ul>
              : <p className="muted">No education lines extracted</p>}
          </div>

          <div className="result-actions">
            <button className="btn-primary" onClick={() => navigate('/jobs')}>
              View Job Recommendations →
            </button>
            <button className="btn-outline" onClick={() => { setFile(null); setResult(null); }}>
              Upload Another Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;
