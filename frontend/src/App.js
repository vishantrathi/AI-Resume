import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CandidateDashboard from './pages/CandidateDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import ResumeUpload from './pages/ResumeUpload';
import JobRecommendations from './pages/JobRecommendations';
import JobList from './pages/JobList';
import PostJob from './pages/PostJob';
import SkillAnalysis from './pages/SkillAnalysis';
import SavedJobs from './pages/SavedJobs';
import CareerRoadmap from './pages/CareerRoadmap';
import AccountSettings from './pages/AccountSettings';
import TrackingAdmin from './pages/TrackingAdmin';
import AuthCallback from './pages/AuthCallback';
import TrackingManager from './components/TrackingManager';
import './App.css';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/dashboard'} /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/dashboard'} /> : <Register />}
      />
      <Route path="/jobs" element={<JobList />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Candidate routes */}
      <Route
        path="/dashboard"
        element={<PrivateRoute role="candidate"><CandidateDashboard /></PrivateRoute>}
      />
      <Route
        path="/upload"
        element={<PrivateRoute role="candidate"><ResumeUpload /></PrivateRoute>}
      />
      <Route
        path="/recommendations"
        element={<PrivateRoute role="candidate"><JobRecommendations /></PrivateRoute>}
      />
      <Route
        path="/skill-analysis"
        element={<PrivateRoute role="candidate"><SkillAnalysis /></PrivateRoute>}
      />
      <Route
        path="/career-roadmap"
        element={<PrivateRoute role="candidate"><CareerRoadmap /></PrivateRoute>}
      />
      <Route
        path="/saved-jobs"
        element={<PrivateRoute role="candidate"><SavedJobs /></PrivateRoute>}
      />
      <Route
        path="/account"
        element={<PrivateRoute><AccountSettings /></PrivateRoute>}
      />

      {/* Recruiter routes */}
      <Route
        path="/recruiter"
        element={<PrivateRoute role="recruiter"><RecruiterDashboard /></PrivateRoute>}
      />
      <Route
        path="/post-job"
        element={<PrivateRoute role="recruiter"><PostJob /></PrivateRoute>}
      />
      <Route
        path="/candidates"
        element={<PrivateRoute role="recruiter"><RecruiterDashboard /></PrivateRoute>}
      />
      <Route
        path="/tracking-admin"
        element={<PrivateRoute role="recruiter"><TrackingAdmin /></PrivateRoute>}
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <AppRoutes />
          </main>
          <TrackingManager />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
