import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLES = {
  beginner:     { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500',  label: 'Beginner'     },
  intermediate: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  label: 'Intermediate' },
  advanced:     { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500',    label: 'Advanced'     },
};

const RESOURCE_ICONS = {
  docs:   '📄',
  course: '🎓',
  video:  '▶️',
};

const ROADMAP_TRACK_STYLES = {
  frontend: 'bg-sky-100 text-sky-800 border-sky-200',
  backend: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  devops: 'bg-amber-100 text-amber-800 border-amber-200',
  data: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  ai: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  mobile: 'bg-orange-100 text-orange-800 border-orange-200',
  security: 'bg-rose-100 text-rose-800 border-rose-200',
  product: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  business: 'bg-teal-100 text-teal-800 border-teal-200',
};

const ROADMAP_SH_CATALOG = [
  { title: 'Frontend', track: 'frontend', url: 'https://roadmap.sh/frontend', keywords: ['frontend', 'react', 'angular', 'vue', 'javascript', 'html', 'css'] },
  { title: 'Backend', track: 'backend', url: 'https://roadmap.sh/backend', keywords: ['backend', 'node', 'express', 'api', 'server'] },
  { title: 'Full Stack', track: 'backend', url: 'https://roadmap.sh/full-stack', keywords: ['full stack', 'fullstack', 'frontend', 'backend'] },
  { title: 'DevOps', track: 'devops', url: 'https://roadmap.sh/devops', keywords: ['devops', 'docker', 'kubernetes', 'terraform', 'ci/cd'] },
  { title: 'JavaScript', track: 'frontend', url: 'https://roadmap.sh/javascript', keywords: ['javascript', 'js', 'node'] },
  { title: 'React', track: 'frontend', url: 'https://roadmap.sh/react', keywords: ['react', 'frontend'] },
  { title: 'Node.js', track: 'backend', url: 'https://roadmap.sh/nodejs', keywords: ['node', 'nodejs', 'express', 'backend'] },
  { title: 'Python', track: 'backend', url: 'https://roadmap.sh/python', keywords: ['python', 'django', 'flask', 'fastapi'] },
  { title: 'Java', track: 'backend', url: 'https://roadmap.sh/java', keywords: ['java', 'spring'] },
  { title: 'Go', track: 'backend', url: 'https://roadmap.sh/golang', keywords: ['go', 'golang'] },
  { title: 'Docker', track: 'devops', url: 'https://roadmap.sh/docker', keywords: ['docker', 'containers'] },
  { title: 'Kubernetes', track: 'devops', url: 'https://roadmap.sh/kubernetes', keywords: ['kubernetes', 'k8s'] },
  { title: 'AWS', track: 'devops', url: 'https://roadmap.sh/aws', keywords: ['aws', 'cloud'] },
  { title: 'Data Analyst', track: 'data', url: 'https://roadmap.sh/data-analyst', keywords: ['data analyst', 'analytics', 'sql', 'tableau'] },
  { title: 'Data Engineer', track: 'data', url: 'https://roadmap.sh/data-engineer', keywords: ['data engineer', 'spark', 'airflow', 'etl'] },
  { title: 'MLOps', track: 'ai', url: 'https://roadmap.sh/mlops', keywords: ['mlops', 'machine learning', 'model deployment'] },
  { title: 'AI Engineer', track: 'ai', url: 'https://roadmap.sh/ai-engineer', keywords: ['ai', 'llm', 'nlp', 'machine learning'] },
  { title: 'Android', track: 'mobile', url: 'https://roadmap.sh/android', keywords: ['android', 'mobile', 'kotlin'] },
  { title: 'iOS', track: 'mobile', url: 'https://roadmap.sh/ios', keywords: ['ios', 'swift', 'mobile'] },
  { title: 'Cyber Security', track: 'security', url: 'https://roadmap.sh/cyber-security', keywords: ['security', 'cyber', 'infosec'] },
  { title: 'Product Manager', track: 'product', url: 'https://roadmap.sh/product-manager', keywords: ['product manager', 'pm', 'product'] },
  { title: 'Software Architect', track: 'backend', url: 'https://roadmap.sh/software-architect', keywords: ['architect', 'system design'] },
];

function getTrackStyle(track) {
  return ROADMAP_TRACK_STYLES[track] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function getRoadmapSuggestions(targetRole = '', resumeSkills = []) {
  const roleText = (targetRole || '').toLowerCase();
  const skillsText = (resumeSkills || []).join(' ').toLowerCase();
  const combined = `${roleText} ${skillsText}`;

  const scored = ROADMAP_SH_CATALOG.map((item) => {
    const score = item.keywords.reduce((acc, kw) => {
      const key = kw.toLowerCase();
      return acc + (combined.includes(key) ? 1 : 0);
    }, 0);
    return { ...item, _score: score };
  });

  const top = scored
    .filter((r) => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)
    .map(({ _score, ...rest }) => rest);

  if (top.length > 0) return top;
  return ROADMAP_SH_CATALOG.slice(0, 6);
}

function DifficultyBadge({ difficulty }) {
  const styles = DIFFICULTY_STYLES[difficulty] || DIFFICULTY_STYLES.intermediate;
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${styles.bg} ${styles.text} ${styles.border}`}>
      {styles.label}
    </span>
  );
}

// ─── Timeline step card ───────────────────────────────────────────────────────

function RoadmapStep({ step, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const styles = DIFFICULTY_STYLES[step.difficulty] || DIFFICULTY_STYLES.intermediate;

  return (
    <div className="flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${styles.dot} ring-4 ring-white`}>
          {step.step}
        </div>
        {!isLast && <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: '24px' }} />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden premium-card`}>
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-5 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl" role="img" aria-label="skill">🔧</span>
            <div>
              <h3 className="font-semibold text-gray-900">{step.skill}</h3>
              {step.prerequisites && step.prerequisites.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Prereqs: {step.prerequisites.join(', ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DifficultyBadge difficulty={step.difficulty} />
            <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
          </div>
        </button>

        {/* Resources (expanded) */}
        {expanded && step.resources && step.resources.length > 0 && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-3">
              📚 Learning Resources
            </h4>
            <ul className="space-y-2">
              {step.resources.map((res, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0">{RESOURCE_ICONS[res.type] || '🔗'}</span>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-words"
                  >
                    {res.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {expanded && (!step.resources || step.resources.length === 0) && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <p className="text-sm text-gray-400 mt-4">No resources available for this skill.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const CareerRoadmap = () => {
  const [resume, setResume] = useState(null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resumeRes = await api.get('/resume/me');
        const resume = resumeRes.data;
        setResume(resume);

        const roadmapRes = await api.get(`/resume/${resume._id}/career-roadmap`);
        setRoadmapData(roadmapRes.data);
      } catch (err) {
        if (err.response?.status === 404) {
          // No resume uploaded yet — handled in render
        } else {
          setError(err.response?.data?.message || 'Failed to load career roadmap');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Generating your career roadmap…</p>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md premium-card">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Resume Found</h2>
          <p className="text-gray-500 mb-6">
            Upload your resume to generate a personalized career roadmap.
          </p>
          <Link
            to="/upload"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors"
          >
            Upload Resume
          </Link>
        </div>
      </div>
    );
  }

  const targetRole = roadmapData?.targetRole || 'Software Developer';
  const roadmap = roadmapData?.roadmap || [];
  const suggestedRoadmaps = getRoadmapSuggestions(targetRole, resume?.skills || []);

  const countByDifficulty = (d) => roadmap.filter((s) => s.difficulty === d).length;

  const filteredCatalog = ROADMAP_SH_CATALOG.filter((item) => {
    const passTrack = catalogFilter === 'all' || item.track === catalogFilter;
    const q = search.trim().toLowerCase();
    const passSearch = q.length === 0
      || item.title.toLowerCase().includes(q)
      || item.keywords.some((k) => k.toLowerCase().includes(q));
    return passTrack && passSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-amber-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-amber-700 font-semibold mb-2">
            <Link to="/skill-analysis" className="hover:underline">Skill Analysis</Link>
            <span>›</span>
            <span>Career Roadmap</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Career Roadmap + roadmap.sh Tracks</h1>
          <p className="text-slate-600 mt-1">
            Your personalized learning plan to reach your target role
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Goal card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-700 text-white rounded-2xl p-6 mb-8 shadow-lg">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎯</span>
            <div>
              <p className="text-amber-100 text-sm font-medium uppercase tracking-wide">Career Goal</p>
              <h2 className="text-2xl font-bold">{targetRole}</h2>
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-sm">
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="font-bold text-lg">{roadmap.length}</div>
              <div className="text-amber-100">Skills to Learn</div>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="font-bold text-lg">{countByDifficulty('beginner')}</div>
              <div className="text-amber-100">Beginner</div>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="font-bold text-lg">{countByDifficulty('intermediate')}</div>
              <div className="text-amber-100">Intermediate</div>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="font-bold text-lg">{countByDifficulty('advanced')}</div>
              <div className="text-amber-100">Advanced</div>
            </div>
          </div>
        </div>

        {/* roadmap.sh suggestions */}
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm mb-8 premium-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Recommended roadmap.sh Paths</h2>
              <p className="text-sm text-slate-500 mt-1">
                Curated from roadmap.sh based on your target role and current skill profile.
              </p>
            </div>
            <a
              href="https://roadmap.sh/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Open roadmap.sh
            </a>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {suggestedRoadmaps.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all premium-card"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 group-hover:text-slate-700">{item.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getTrackStyle(item.track)}`}>
                    {item.track}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{item.url.replace('https://', '')}</p>
              </a>
            ))}
          </div>
        </div>

        {/* roadmap.sh catalog */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-8 premium-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">roadmap.sh Catalog</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roadmaps"
              className="w-full sm:w-56 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {['all', 'frontend', 'backend', 'devops', 'data', 'ai', 'mobile', 'security'].map((track) => (
              <button
                key={track}
                onClick={() => setCatalogFilter(track)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  catalogFilter === track
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {track}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {filteredCatalog.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all premium-card"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getTrackStyle(item.track)}`}>
                    {item.track}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{item.keywords.slice(0, 3).join(' • ')}</p>
              </a>
            ))}
          </div>

          {filteredCatalog.length === 0 && (
            <p className="text-sm text-slate-500 mt-4">No roadmap matches this filter.</p>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 flex-wrap mb-6 text-sm">
          {Object.entries(DIFFICULTY_STYLES).map(([key, styles]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${styles.dot}`}></span>
              <span className="text-gray-600">{styles.label}</span>
            </div>
          ))}
          <span className="text-gray-400 text-xs self-center">Click a step to view resources</span>
        </div>

        {/* Timeline */}
        {roadmap.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm premium-card">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">You're All Set!</h3>
            <p className="text-gray-500">
              You already have all the skills required for <strong>{targetRole}</strong>.
              No learning roadmap needed right now.
            </p>
            <Link
              to="/recommendations"
              className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              View Job Matches →
            </Link>
          </div>
        ) : (
          <div>
            {roadmap.map((step, index) => (
              <RoadmapStep key={step.step} step={step} isLast={index === roadmap.length - 1} />
            ))}

            {/* CTA */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
              <p className="text-blue-700 font-medium mb-3">Ready to start your journey?</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  to="/recommendations"
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  View Job Matches →
                </Link>
                <Link
                  to="/skill-analysis"
                  className="bg-white text-blue-600 border border-blue-200 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  Skill Analysis
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CareerRoadmap;
