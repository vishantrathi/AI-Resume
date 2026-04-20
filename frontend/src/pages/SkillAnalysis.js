import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const SkillAnalysis = () => {
  const [resume, setResume] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [skillGap, setSkillGap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gapLoading, setGapLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resumeRes, jobsRes] = await Promise.all([
          api.get('/resume/me'),
          api.get('/jobs'),
        ]);
        setResume(resumeRes.data);
        setJobs(jobsRes.data);
      } catch (err) {
        if (err.response?.status !== 404) {
          setError('Failed to load data');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const analyzeSkillGap = async (jobId) => {
    setGapLoading(true);
    setSkillGap(null);
    setSelectedJob(jobId);
    try {
      const res = await api.get(`/candidate/skill-gap/${jobId}`);
      setSkillGap(res.data);
    } catch (err) {
      setError('Failed to fetch skill gap analysis');
    } finally {
      setGapLoading(false);
    }
  };

  const getSkillColor = (index, total) => {
    const hue = (index / total) * 200 + 180;
    return `hsl(${hue}, 70%, 45%)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading skill analysis...</p>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md premium-card">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Resume Found</h2>
          <p className="text-gray-500 mb-6">Upload your resume to see your skill analysis and gap report.</p>
          <Link to="/upload" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
            Upload Resume
          </Link>
        </div>
      </div>
    );
  }

  const skills = resume.skills || [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Skill Analysis</h1>
          <p className="text-gray-500 mt-1">Visualize your skills and discover gaps for target roles</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Skills Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Skill Cloud */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 premium-card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>🎯</span> Your Skills ({skills.length})
              </h2>
              {skills.length === 0 ? (
                <p className="text-gray-400 text-sm">No skills extracted yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-white text-sm font-medium"
                      style={{ backgroundColor: getSkillColor(i, skills.length) }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Stats Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 premium-card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>📈</span> Statistics
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Total Skills</span>
                  <span className="font-bold text-gray-800">{skills.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Available Jobs</span>
                  <span className="font-bold text-gray-800">{jobs.length}</span>
                </div>
                {skillGap && (
                  <>
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-sm">Match Score</span>
                        <span className={`font-bold ${skillGap.matchingScore >= 70 ? 'text-green-600' : skillGap.matchingScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {skillGap.matchingScore}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${skillGap.matchingScore >= 70 ? 'bg-green-500' : skillGap.matchingScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${skillGap.matchingScore}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Matched Skills</span>
                      <span className="font-bold text-green-600">{skillGap.matchedSkills?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Missing Skills</span>
                      <span className="font-bold text-red-600">{skillGap.missingSkills?.length || 0}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 premium-card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>🔍</span> Analyze Skill Gap for a Job
              </h2>
              {jobs.length === 0 ? (
                <p className="text-gray-400 text-sm">No jobs available. Post jobs or use job discovery.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {jobs.map((job) => (
                    <button
                      key={job._id}
                      onClick={() => analyzeSkillGap(job._id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedJob === job._id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold text-gray-800 text-sm">{job.title}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{job.company}</div>
                      {job.location && (
                        <div className="text-gray-400 text-xs mt-1">📍 {job.location}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skill Gap Results */}
            {gapLoading && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 flex items-center justify-center premium-card">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-500 text-sm">Analyzing skill gap...</p>
                </div>
              </div>
            )}

            {skillGap && !gapLoading && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 premium-card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">{skillGap.job?.title}</h2>
                    <p className="text-gray-500 text-sm">{skillGap.job?.company}</p>
                  </div>
                  <div className={`text-3xl font-bold ${skillGap.matchingScore >= 70 ? 'text-green-600' : skillGap.matchingScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {skillGap.matchingScore}%
                  </div>
                </div>

                {/* Match Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Match Score</span>
                    <span>{skillGap.matchingScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${skillGap.matchingScore >= 70 ? 'bg-green-500' : skillGap.matchingScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${skillGap.matchingScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Matched Skills */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                      <span className="text-green-500">✓</span> Matched Skills ({skillGap.matchedSkills?.length || 0})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(skillGap.matchedSkills || []).length === 0 ? (
                        <p className="text-gray-400 text-sm">No matching skills found</p>
                      ) : (
                        skillGap.matchedSkills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            ✓ {skill}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Missing Skills */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                      <span className="text-red-500">✗</span> Missing Skills ({skillGap.missingSkills?.length || 0})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(skillGap.missingSkills || []).length === 0 ? (
                        <p className="text-gray-400 text-sm">No missing skills — great fit!</p>
                      ) : (
                        skillGap.missingSkills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                            ✗ {skill}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Learning Suggestions + Career Roadmap CTA */}
                {(skillGap.missingSkills || []).length > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 Learning Suggestions</h3>
                    <p className="text-blue-700 text-sm">
                      Focus on acquiring these skills to improve your match score:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {skillGap.missingSkills.slice(0, 5).map((skill, i) => (
                        <li key={i} className="text-blue-600 text-sm flex items-center gap-2">
                          <span>→</span>
                          <span>{skill} — look for online courses on Coursera, Udemy, or official docs</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <Link
                        to="/career-roadmap"
                        className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                      >
                        🗺️ Generate Career Roadmap →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillAnalysis;
