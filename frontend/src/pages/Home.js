import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BRAND_NAME = 'JobMatch';

const Home = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: '01',
      title: 'Precision Resume Intelligence',
      description: 'Upload PDF or DOCX and extract validated skills, experience, education, and projects in seconds.',
    },
    {
      icon: '02',
      title: 'Deep Skill Mapping',
      description: 'Detects 150+ technologies, frameworks, and role signals to build a high-fidelity candidate profile.',
    },
    {
      icon: '03',
      title: 'Semantic Fit Scoring',
      description: 'Relevance is ranked with semantic similarity, not shallow keyword overlap, for significantly better matches.',
    },
    {
      icon: '04',
      title: 'Skill Gap Clarity',
      description: 'Get a role-specific breakdown of matched and missing skills with actionable next steps.',
    },
    {
      icon: '05',
      title: 'Live Market Discovery',
      description: 'If local opportunities are limited, the system discovers fresh openings from external sources in real time.',
    },
    {
      icon: '06',
      title: 'Enterprise-Grade Safety',
      description: 'JWT auth, secure uploads, and rate limiting protect user data and operational reliability.',
    },
  ];

  const stats = [
    { value: '150+', label: 'Skills Detected' },
    { value: 'NLP + Vector AI', label: 'Scoring Engine' },
    { value: 'PDF / DOCX', label: 'Resume Ready' },
    { value: 'Live', label: 'Discovery Mode' },
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-stone-50">
      <div className="pointer-events-none absolute -top-28 -left-28 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl animate-pulse"></div>
      <div className="pointer-events-none absolute top-20 -right-20 h-80 w-80 rounded-full bg-slate-300/25 blur-3xl animate-pulse"></div>

      {/* Hero Section */}
      <section className="relative border-b border-amber-100/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 text-slate-700 rounded-full text-xs sm:text-sm font-semibold mb-6 border border-amber-200/70 shadow-sm">
            <span className="text-amber-600">●</span> Premium NLP Hiring Intelligence Platform
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
            {BRAND_NAME}
            <br />
            <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-amber-600 bg-clip-text text-transparent">
              Matches Talent With Precision
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto mb-10">
            A premium workspace for candidates and recruiters to evaluate fit, discover opportunities,
            and make confident hiring decisions with semantic AI.
          </p>

          {!user ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold text-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-400/20"
              >
                Launch Workspace
              </Link>
              <Link
                to="/jobs"
                className="px-8 py-4 bg-white/90 text-slate-700 rounded-2xl font-semibold text-lg hover:bg-white transition-colors border border-slate-200"
              >
                Browse Jobs
              </Link>
            </div>
          ) : user.role === 'candidate' ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/upload"
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold text-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-400/20"
              >
                Upload Resume
              </Link>
              <Link
                to="/recommendations"
                className="px-8 py-4 bg-white/90 text-slate-700 rounded-2xl font-semibold text-lg hover:bg-white transition-colors border border-slate-200"
              >
                View Matches
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/post-job"
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold text-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-400/20"
              >
                Post a Job
              </Link>
              <Link
                to="/recruiter"
                className="px-8 py-4 bg-white/90 text-slate-700 rounded-2xl font-semibold text-lg hover:bg-white transition-colors border border-slate-200"
              >
                View Dashboard
              </Link>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 pt-10 border-t border-amber-100">
            {stats.map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-2xl bg-white/60 border border-white shadow-sm">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Designed For High-Confidence Decisions</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Every interaction is optimized for clarity, speed, and measurable hiring outcomes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="group bg-white/90 rounded-3xl border border-amber-100 p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-100 text-slate-800 font-black mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Job Discovery Pipeline */}
      <section className="bg-white/80 border-t border-b border-slate-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Signal-To-Decision Pipeline</h2>
            <p className="text-lg text-slate-500">A dependable flow from resume insight to ranked opportunities.</p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-4xl mx-auto">
            {[
              { step: '1', label: 'Upload Resume', icon: 'R' },
              { step: '2', label: 'Extract Signals', icon: 'N' },
              { step: '3', label: 'Search Openings', icon: 'J' },
              { step: '4', label: 'Discover Externally', icon: 'W' },
              { step: '5', label: 'Rank By Fit', icon: 'F' },
            ].map((item, i, arr) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center text-xl font-bold text-slate-800 mb-2">
                    {item.icon}
                  </div>
                  <div className="text-xs font-semibold text-amber-700 mb-0.5">Step {item.step}</div>
                  <div className="text-sm font-medium text-slate-700 max-w-[120px]">{item.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:block text-slate-300 text-2xl">→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="bg-slate-900 rounded-[2rem] p-12 text-white shadow-2xl shadow-slate-500/25">
            <h2 className="text-3xl font-extrabold mb-4">Launch {BRAND_NAME}</h2>
            <p className="text-slate-200 text-lg mb-8 max-w-xl mx-auto">
              Build your profile, discover opportunities, and move from application to outcome with a premium AI workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-amber-300 text-slate-900 rounded-2xl font-bold hover:bg-amber-200 transition-colors"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-semibold hover:bg-slate-700 transition-colors border border-slate-600"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
