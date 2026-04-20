import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { completeSocialLogin } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userB64 = params.get('user');

      if (!token || !userB64) {
        setError('Invalid social login response');
        return;
      }

      const json = atob(userB64);
      const user = JSON.parse(json);
      const authUser = completeSocialLogin(token, user);
      navigate(authUser.role === 'recruiter' ? '/recruiter' : '/dashboard', { replace: true });
    } catch (_err) {
      setError('Social login failed. Please try again.');
    }
  }, [completeSocialLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm premium-card text-center max-w-md w-full">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-red-700">Authentication Error</h1>
            <p className="text-sm text-red-600 mt-2">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              Back To Login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Signing you in...</h1>
            <p className="text-sm text-slate-600 mt-2">Completing social authentication.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
