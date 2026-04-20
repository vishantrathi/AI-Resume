import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AccountSettings = () => {
  const { user, deleteProfile } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete || loading) return;
    setLoading(true);
    setError('');

    try {
      await deleteProfile();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm premium-card">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 mt-2">
            Manage your account and privacy controls.
          </p>

          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-bold text-red-700">Delete Account</h2>
            <p className="text-red-600 text-sm mt-2">
              This action permanently deletes your profile and related data from the database.
              This cannot be undone.
            </p>

            <div className="mt-4 text-sm text-red-700">
              <p>Name: {user?.name || '-'}</p>
              <p>Email: {user?.email || '-'}</p>
              <p>Role: {user?.role || '-'}</p>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-red-700 mb-2">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-red-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleDelete}
              disabled={!canDelete || loading}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete My Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
