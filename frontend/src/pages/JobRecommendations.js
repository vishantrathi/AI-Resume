import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import api from '../api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STRONG_MATCH_THRESHOLD = 70;
const GOOD_MATCH_THRESHOLD = 40;

function scoreColor(score) {
  if (score >= STRONG_MATCH_THRESHOLD) return '#10b981'; // green
  if (score >= GOOD_MATCH_THRESHOLD) return '#f59e0b';   // amber
  return '#ef4444';                                       // red
}

function scoreGradientStyle(score) {
  if (score >= STRONG_MATCH_THRESHOLD) return { background: 'linear-gradient(to right, #34d399, #16a34a)' };
  if (score >= GOOD_MATCH_THRESHOLD) return { background: 'linear-gradient(to right, #fbbf24, #f97316)' };
  return { background: 'linear-gradient(to right, #f87171, #e11d48)' };
}

function confidenceLabel(rec) {
  const score = Number(rec?.matchingScore || 0);
  const matchedCount = (rec?.matchedSkills || []).length;
  const missingCount = (rec?.missingSkills || []).length;
  const knownSkillCount = matchedCount + missingCount;
  const skillCoverage = knownSkillCount > 0 ? matchedCount / knownSkillCount : 0;

  // If the job has weak extracted skill data, avoid overconfident labels.
  if (knownSkillCount === 0) return 'Limited Data';
  if (score >= 70 && skillCoverage >= 0.65) return 'Strong Match';
  if (score >= 45 && skillCoverage >= 0.4) return 'Good Match';
  return 'Low Match';
}

function confidenceBadgeStyle(label) {
  if (label === 'Strong Match') return { background: 'linear-gradient(to right, #34d399, #16a34a)', color: '#fff' };
  if (label === 'Good Match') return { background: 'linear-gradient(to right, #fbbf24, #f97316)', color: '#fff' };
  if (label === 'Limited Data') return { background: 'linear-gradient(to right, #94a3b8, #64748b)', color: '#fff' };
  return { background: 'linear-gradient(to right, #f87171, #e11d48)', color: '#fff' };
}

function initials(company) {
  if (!company) return '?';
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

function getHostnameFromUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const hostname = new URL(rawUrl).hostname || '';
    return hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_err) {
    return '';
  }
}

function buildCompanyLogoUrl(job) {
  const hostname = getHostnameFromUrl(job?.url || job?.applicationLink || '');
  if (!hostname) return '';
  return `https://logo.clearbit.com/${hostname}`;
}

function CompanyAvatar({ company, job }) {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = buildCompanyLogoUrl(job);

  if (logoUrl && !logoError) {
    return (
      <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <img
          src={logoUrl}
          alt={`${company || 'Company'} logo`}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setLogoError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
    >
      {initials(company)}
    </div>
  );
}

function recommendationKey(rec) {
  const source = (rec?.source || 'unknown').toLowerCase();
  const job = rec?.job || {};
  return String(
    rec?.id ||
    job?._id ||
    `${source}::${job?.url || ''}::${job?.title || ''}::${job?.company || ''}`
  );
}

// ─── Source portal labels + styles ────────────────────────────────────────────
const SOURCE_META = {
  linkedin:    { label: 'LinkedIn',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   icon: '💼' },
  indeed:      { label: 'Indeed',      bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: '🔍' },
  glassdoor:   { label: 'Glassdoor',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  icon: '🪟' },
  naukri:      { label: 'Naukri',      bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '📋' },
  internshala: { label: 'Internshala', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: '🎓' },
  wellfound:   { label: 'Wellfound',   bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200',   icon: '🚀' },
  themuse:     { label: 'The Muse',    bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', icon: '📰' },
  company:     { label: 'Company',     bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   icon: '🏢' },
  remoteok:    { label: 'RemoteOK',    bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200',   icon: '🌍' },
  scraped:     { label: 'Live',        bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', icon: '🌐' },
  db:          { label: 'Posted',      bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  icon: '📌' },
};

function SourceBadge({ source }) {
  if (!source || source === 'db') return null;
  const meta = SOURCE_META[source] || SOURCE_META.scraped;
  return (
    <span className={`text-xs ${meta.bg} ${meta.text} border ${meta.border} px-2 py-0.5 rounded-full`}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─── Animated match score circle ─────────────────────────────────────────────
function ScoreCircle({ score }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg className="absolute inset-0 rotate-[-90deg]" width="80" height="80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <motion.circle
          cx="40" cy="40" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="text-lg font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ rec, onSelect, isSelected, isSaved, onSave, onApply, onRemove, actionBusy }) {
  const { job = {}, matchingScore = 0, matchedSkills = [], missingSkills = [], source } = rec;
  const label = confidenceLabel(rec);
  const allSkills = [
    ...matchedSkills.map((s) => ({ name: s, matched: true })),
    ...missingSkills.map((s) => ({ name: s, matched: false })),
  ].slice(0, 8);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={() => onSelect(rec)}
      className={`cursor-pointer p-5 transition-colors premium-job-card
        ${isSelected ? 'premium-job-card-selected' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Company avatar + info */}
        <div className="flex items-center gap-3 min-w-0">
          <CompanyAvatar company={job.company} job={job} />
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
              {job.title || 'Unknown Role'}
            </h3>
            <p className="text-sm text-slate-600 truncate font-medium">{job.company}</p>
            {job.location && (
              <p className="text-xs text-slate-500 truncate mt-0.5">📍 {job.location}</p>
            )}
          </div>
        </div>

        {/* Score + save */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <ScoreCircle score={matchingScore} />
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={confidenceBadgeStyle(label)}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Salary + source badge */}
      <div className="flex items-center gap-2 mb-3 premium-job-meta">
        {job.salary && (
          <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
            💰 {job.salary}
          </span>
        )}
        <SourceBadge source={source} />
      </div>

      {/* Skill tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {allSkills.map(({ name, matched }) => (
          <span
            key={name}
            className={`text-xs px-2 py-0.5 rounded-full font-medium border
              ${matched
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-600 border-red-200'
              }`}
          >
            {matched ? '✓' : '✗'} {name}
          </span>
        ))}
        {(matchedSkills.length + missingSkills.length) > 8 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            +{matchedSkills.length + missingSkills.length - 8} more
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Match</span>
          <span>{matchingScore}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-2 rounded-full"
            style={scoreGradientStyle(matchingScore)}
            initial={{ width: 0 }}
            animate={{ width: `${matchingScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onApply(rec); }}
          disabled={actionBusy || !job.url}
          className="flex-1 text-center text-sm py-2 px-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed premium-action-primary"
        >
          {actionBusy ? 'Saving...' : (job.url ? 'Mark Applied & Apply' : 'No Link Available')}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(rec); }}
          disabled={actionBusy}
          className="text-sm py-2 px-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed premium-action-danger"
          title="Remove this recommendation"
        >
          Remove
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onSave(rec); }}
          className={`text-sm py-2 px-3 rounded-xl border font-semibold transition-colors
            ${isSaved
              ? 'premium-action-save'
              : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700'
            }`}
          title={isSaved ? 'Saved' : 'Save job'}
        >
          {isSaved ? '⭐' : '☆'}
        </button>
      </div>
    </motion.div>
  );
}

const STAT_COLORS = {
  blue: '#2563eb',
  purple: '#7c3aed',
  green: '#059669',
  amber: '#d97706',
};

// ─── Stats header ─────────────────────────────────────────────────────────────
function StatsHeader({ recommendations, skills }) {
  const qualityRecommendations = recommendations.filter((r) => {
    const score = Number(r?.matchingScore || 0);
    const knownSkills = (r?.matchedSkills?.length || 0) + (r?.missingSkills?.length || 0);
    return score > 0 || knownSkills > 0;
  });

  const bestMatch = qualityRecommendations.length > 0
    ? Math.max(...qualityRecommendations.map((r) => r.matchingScore))
    : 0;
  const avgMatch = qualityRecommendations.length > 0
    ? Math.round(qualityRecommendations.reduce((s, r) => s + r.matchingScore, 0) / qualityRecommendations.length)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        { label: 'Skills Detected', value: skills.length, icon: '🎯', color: 'blue' },
        { label: 'Reliable Analyses', value: qualityRecommendations.length, icon: '💼', color: 'purple' },
        { label: 'Best Match', value: `${bestMatch}%`, icon: '🏆', color: 'green' },
        { label: 'Avg Match', value: `${avgMatch}%`, icon: '📊', color: 'amber' },
      ].map(({ label, value, icon, color }) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm premium-card"
        >
          <div className="text-2xl mb-1">{icon}</div>
          <div className="text-2xl font-bold" style={{ color: STAT_COLORS[color] }}>{value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Charts panel ─────────────────────────────────────────────────────────────
function ChartsPanel({ recommendations, skills }) {
  // Build histogram data: buckets 0-20, 20-40, 40-60, 60-80, 80-100
  const buckets = [
    { range: '0–20', min: 0, max: 20 },
    { range: '20–40', min: 20, max: 40 },
    { range: '40–60', min: 40, max: 60 },
    { range: '60–80', min: 60, max: 80 },
    { range: '80–100', min: 80, max: 101 },
  ].map((b) => ({
    ...b,
    count: recommendations.filter((r) => r.matchingScore >= b.min && r.matchingScore < b.max).length,
  }));

  const bucketColors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'];

  // Radar data based on top skill categories
  const topSkills = skills.slice(0, 6);
  const radarData = topSkills.map((skill, i) => {
    const jobsWithSkill = recommendations.filter((r) =>
      r.matchedSkills.some((s) => s.toLowerCase() === skill.toLowerCase()),
    );
    return {
      skill: skill.length > 10 ? skill.substring(0, 10) + '…' : skill,
      matches: jobsWithSkill.length,
      fullMark: Math.max(recommendations.length, 1),
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Histogram */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm premium-card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">📊 Match Score Distribution</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={buckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(v) => [v, 'Jobs']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {buckets.map((_, idx) => (
                <Cell key={idx} fill={bucketColors[idx]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar */}
      {radarData.length >= 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm premium-card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">🕸️ Skill Match Radar</h3>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} />
              <Radar
                name="Matches"
                dataKey="matches"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Skill gap detail panel ───────────────────────────────────────────────────
function GapPanel({ selected, onClose }) {
  if (!selected) return null;
  const { job = {}, matchingScore = 0, skillMatchScore: rawSkillScore, matchedSkills = [], missingSkills = [] } = selected;
  const skillMatchScore = rawSkillScore || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-4 premium-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900">{job.title}</h2>
          <p className="text-sm text-gray-500">{job.company}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Overall Match Score bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Match Score</span>
          <strong style={{ color: scoreColor(matchingScore) }}>{matchingScore}%</strong>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-3 rounded-full"
            style={scoreGradientStyle(matchingScore)}
            initial={{ width: 0 }}
            animate={{ width: `${matchingScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Skill Match Score bar */}
      <div className="mb-5">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Skill Match</span>
          <strong style={{ color: scoreColor(skillMatchScore) }}>{skillMatchScore}%</strong>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <motion.div
            className="h-2.5 rounded-full"
            style={scoreGradientStyle(skillMatchScore)}
            initial={{ width: 0 }}
            animate={{ width: `${skillMatchScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>

      {/* Matched */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          ✅ Matched Skills ({matchedSkills.length})
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {matchedSkills.length === 0 ? (
            <span className="text-xs text-gray-400">None</span>
          ) : matchedSkills.map((s) => (
            <span key={s} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
              ✓ {s}
            </span>
          ))}
        </div>
      </div>

      {/* Missing */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          ❌ Missing Skills ({missingSkills.length})
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {missingSkills.length === 0 ? (
            <span className="text-xs text-gray-400">None — perfect fit! 🎉</span>
          ) : missingSkills.map((s) => (
            <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              ✗ {s}
            </span>
          ))}
        </div>
      </div>

      {/* Tip + Career Roadmap CTA */}
      {missingSkills.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 mb-3">
          <p className="mb-2">💡 Learn <strong>{missingSkills.slice(0, 2).join(', ')}</strong> to boost your match.</p>
          <Link
            to="/career-roadmap"
            className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            🗺️ View Career Roadmap →
          </Link>
        </div>
      )}

      {/* Apply */}
      {job.url ? (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
        >
          Apply Now →
        </a>
      ) : null}
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const JobRecommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState('score');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [savedIds, setSavedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('savedJobs') || '[]')); }
    catch (_) { return new Set(); }
  });
  const [newJobsAlert, setNewJobsAlert] = useState(false);
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' });
  const [actionJobKey, setActionJobKey] = useState('');
  const prevCountRef = useRef(0);

  const fetchRecommendations = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      if (isInitial) {
        // Trigger match computation on first load
        await api.post('/jobs/match', {}).catch(() => {});
      }

      const [recRes, resumeRes] = await Promise.allSettled([
        api.get('/jobs/recommendations'),
        api.get('/resume/me'),
      ]);

      if (recRes.status === 'fulfilled') {
        const data = recRes.value.data;
        setRecommendations((prev) => {
          if (!isInitial && data.length > prev.length) {
            setNewJobsAlert(true);
            setTimeout(() => setNewJobsAlert(false), 4000);
          }
          prevCountRef.current = data.length;
          return data;
        });
      }

      if (resumeRes.status === 'fulfilled') {
        setSkills(resumeRes.value.data?.skills || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRecommendations(true);
  }, [fetchRecommendations]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchRecommendations(false), 30000);
    return () => clearInterval(interval);
  }, [fetchRecommendations]);

  const handleSave = (rec) => {
    const key = recommendationKey(rec);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem('savedJobs', JSON.stringify([...next]));
      return next;
    });
  };

  const handleAction = async (actionType, rec) => {
    const key = recommendationKey(rec);
    setActionJobKey(key);
    setActionStatus({ type: '', message: '' });
    try {
      await api.post('/candidate/job-actions', { actionType, recommendation: rec });
      setRecommendations((prev) => prev.filter((item) => recommendationKey(item) !== key));
      if (selected && recommendationKey(selected) === key) {
        setSelected(null);
      }
      await fetchRecommendations(false);
      setActionStatus({
        type: 'success',
        message: actionType === 'applied'
          ? 'Job marked as applied and moved out of recommendations.'
          : 'Job removed from recommendations.',
      });

      const applyUrl = rec?.job?.url;
      if (actionType === 'applied' && applyUrl) {
        window.open(applyUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setActionStatus({
        type: 'error',
        message: err.response?.data?.message || 'Could not update job action right now.',
      });
    } finally {
      setActionJobKey('');
    }
  };

  // Filter + sort
  const filtered = recommendations
    .filter((r) => {
      if (r.matchingScore < minScore) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        r.job?.title?.toLowerCase().includes(q) ||
        r.job?.company?.toLowerCase().includes(q) ||
        r.job?.location?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.matchingScore - a.matchingScore;
      if (sortBy === 'title') return (a.job?.title || '').localeCompare(b.job?.title || '');
      if (sortBy === 'company') return (a.job?.company || '').localeCompare(b.job?.company || '');
      return 0;
    });

  // Collect unique source values for the filter dropdown
  const availableSources = ['all', ...new Set(recommendations.map((r) => r.source).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-gray-500 text-sm">Analysing your resume and finding matches…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* New jobs toast */}
        <AnimatePresence>
          {newJobsAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2"
            >
              ✨ New jobs found! Recommendations updated.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🎯 Job Recommendations</h1>
            <p className="text-gray-500 text-sm mt-1">
              AI-powered matches based on your resume · Auto-refreshes every 30s
            </p>
          </div>
          <div className="flex items-center gap-2">
            {refreshing && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
              />
            )}
            <button
              onClick={() => fetchRecommendations(true)}
              className="text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl font-medium transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {actionStatus.message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm border ${actionStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {actionStatus.message}
          </div>
        )}

        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">💼</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Recommendations Yet</h2>
            <p className="text-gray-500 mb-6 max-w-sm">
              Upload your resume to get personalised, AI-powered job recommendations.
            </p>
            <Link
              to="/upload"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Upload Resume
            </Link>
          </div>
        ) : (
          <>
            {/* Stats + Charts */}
            <StatsHeader recommendations={recommendations} skills={skills} />
            <ChartsPanel recommendations={recommendations} skills={skills} />

            {/* Controls */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center shadow-sm premium-card">
              <input
                type="text"
                placeholder="Search jobs, companies…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 min-w-[180px] text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-500 whitespace-nowrap">Min Score:</label>
                <input
                  type="range" min="0" max="90" step="10"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-24 accent-blue-600"
                />
                <span className="text-blue-600 font-medium w-8">{minScore}%</span>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="score">Sort: Best Match</option>
                <option value="title">Sort: Job Title</option>
                <option value="company">Sort: Company</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src === 'all'
                      ? 'All Sources'
                      : (SOURCE_META[src]?.label || (src ? src.charAt(0).toUpperCase() + src.slice(1) : 'Other'))}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-400">{filtered.length} results</span>
            </div>

            {/* Main grid */}
            <div className="flex gap-6">
              {/* Job cards */}
              <div className={`flex-1 min-w-0 ${selected ? 'hidden md:block' : ''}`}>
                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">🔍</p>
                    <p>No jobs match your current filters.</p>
                  </div>
                ) : (
                  <motion.div
                    layout
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                  >
                    <AnimatePresence mode="popLayout">
                      {filtered.map((rec) => {
                        const key = recommendationKey(rec);
                        return (
                          <JobCard
                            key={key}
                            rec={rec}
                            isSelected={selected && recommendationKey(selected) === key}
                            isSaved={savedIds.has(key)}
                            onSelect={setSelected}
                            onSave={handleSave}
                            onApply={(item) => handleAction('applied', item)}
                            onRemove={(item) => handleAction('removed', item)}
                            actionBusy={actionJobKey === key}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>

              {/* Detail panel */}
              <AnimatePresence>
                {selected && (
                  <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
                    <GapPanel selected={selected} onClose={() => setSelected(null)} />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JobRecommendations;
