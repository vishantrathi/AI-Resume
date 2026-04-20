import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BRAND_NAME = 'JobMatch';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
      isActive(path)
        ? 'bg-amber-100 text-slate-900'
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-amber-100/70 bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 text-slate-900">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900 shadow-sm flex items-center justify-center text-lg font-black">
              A
            </span>
            <span className="hidden sm:flex flex-col leading-none">
              <span className="text-[0.66rem] uppercase tracking-[0.26em] text-slate-500">Smart Job Search</span>
              <span className="text-lg font-extrabold">{BRAND_NAME}</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {!user ? (
              <>
                <Link to="/jobs" className={linkClass('/jobs')}>Browse Jobs</Link>
                <div className="w-px h-5 bg-slate-200 mx-2"></div>
                <Link to="/login" className={linkClass('/login')}>Log in</Link>
                <Link
                  to="/register"
                  className="ml-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  Start Free
                </Link>
              </>
            ) : (
              <>
                {user.role === 'candidate' ? (
                  <>
                    <Link to="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
                    <Link to="/upload" className={linkClass('/upload')}>Upload Resume</Link>
                    <Link to="/recommendations" className={linkClass('/recommendations')}>Matches</Link>
                    <Link to="/skill-analysis" className={linkClass('/skill-analysis')}>Skills</Link>
                    <Link to="/career-roadmap" className={linkClass('/career-roadmap')}>Roadmap</Link>
                    <Link to="/saved-jobs" className={linkClass('/saved-jobs')}>Discover</Link>
                    <Link to="/jobs" className={linkClass('/jobs')}>Jobs</Link>
                    <Link to="/account" className={linkClass('/account')}>Account</Link>
                  </>
                ) : (
                  <>
                    <Link to="/recruiter" className={linkClass('/recruiter')}>Dashboard</Link>
                    <Link to="/post-job" className={linkClass('/post-job')}>Post Job</Link>
                    <Link to="/candidates" className={linkClass('/candidates')}>Candidates</Link>
                    <Link to="/tracking-admin" className={linkClass('/tracking-admin')}>Analytics</Link>
                    <Link to="/account" className={linkClass('/account')}>Account</Link>
                  </>
                )}
                <div className="w-px h-5 bg-slate-200 mx-2"></div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-200 text-slate-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 font-medium hidden lg:block">{user.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 px-3 py-2 text-sm text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors font-medium"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-1 bg-white/95">
            {!user ? (
              <>
                <Link to="/jobs" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Browse Jobs</Link>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Log in</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-2 bg-slate-900 text-white rounded-xl font-medium mx-4 text-center">Start Free</Link>
              </>
            ) : (
              <>
                {user.role === 'candidate' ? (
                  <>
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Dashboard</Link>
                    <Link to="/upload" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Upload Resume</Link>
                    <Link to="/recommendations" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Matches</Link>
                    <Link to="/skill-analysis" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Skill Analysis</Link>
                    <Link to="/career-roadmap" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Career Roadmap</Link>
                    <Link to="/saved-jobs" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Discover Jobs</Link>
                    <Link to="/jobs" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Browse Jobs</Link>
                    <Link to="/account" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Account Settings</Link>
                  </>
                ) : (
                  <>
                    <Link to="/recruiter" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Dashboard</Link>
                    <Link to="/post-job" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Post Job</Link>
                    <Link to="/candidates" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Candidates</Link>
                    <Link to="/tracking-admin" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Tracking Analytics</Link>
                    <Link to="/account" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl">Account Settings</Link>
                  </>
                )}
                <div className="px-4 py-2 text-sm text-slate-500">Signed in as {user.name}</div>
                <button
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

