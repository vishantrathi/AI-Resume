import React, { useEffect, useState } from 'react';
import api from '../api';

function formatMinutes(ms) {
  return Math.round((ms || 0) / 60000);
}

const TrackingAdmin = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/tracking/admin/overview');
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load tracking analytics');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) {
    return <div className="loading">Loading tracking analytics...</div>;
  }

  if (error) {
    return <div className="page-container"><div className="alert alert-error">{error}</div></div>;
  }

  const totals = data?.totals || {
    totalEvents: 0,
    totalTrackedMinutes: 0,
    totalInteractions: 0,
    avgScrollDepth: 0,
    uniqueUsers: 0,
  };

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <h1>Tracking Admin Panel</h1>
        <p className="page-subtitle">Heavy analytics for page movement, section dwell time, and engagement.</p>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{totals.uniqueUsers}</span>
          <span className="stat-label">Active Users (30d)</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{totals.totalEvents}</span>
          <span className="stat-label">Tracking Events</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{totals.totalTrackedMinutes}</span>
          <span className="stat-label">Tracked Minutes</span>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{totals.totalInteractions}</span>
          <span className="stat-label">Interactions</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{totals.avgScrollDepth}%</span>
          <span className="stat-label">Avg Scroll Depth</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{data?.rangeDays || 30}d</span>
          <span className="stat-label">Reporting Window</span>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{formatMinutes((data?.hourly || []).reduce((s, h) => s + (h.totalDurationMs || 0), 0))}</span>
          <span className="stat-label">Hourly Time Sum (min)</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{(data?.topTransitions || []).length}</span>
          <span className="stat-label">Top Route Flows</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{(data?.topClickTargets || []).reduce((s, c) => s + (c.totalClicks || 0), 0)}</span>
          <span className="stat-label">Tracked Clicks</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h2>Top Routes by Time</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Events</th>
                  <th>Time (min)</th>
                  <th>Avg Scroll</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topRoutes || []).map((item) => (
                  <tr key={item.route}>
                    <td>{item.route}</td>
                    <td>{item.events}</td>
                    <td>{formatMinutes(item.totalDurationMs)}</td>
                    <td>{item.avgScrollDepth}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Top Sections by Dwell Time</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Events</th>
                  <th>Time (min)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topSections || []).map((item) => (
                  <tr key={item.section}>
                    <td>{item.section}</td>
                    <td>{item.events}</td>
                    <td>{formatMinutes(item.totalDurationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="dashboard-grid mt-2">
        <div className="card">
          <h2>Top Referrers</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th>Events</th>
                  <th>Time (min)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topReferrers || []).map((item) => (
                  <tr key={item.referrer}>
                    <td>{item.referrer}</td>
                    <td>{item.events}</td>
                    <td>{formatMinutes(item.totalDurationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Top Click Targets</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Total Clicks</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topClickTargets || []).map((item) => (
                  <tr key={item.target}>
                    <td>{item.target}</td>
                    <td>{item.totalClicks}</td>
                    <td>{item.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="dashboard-grid mt-2">
        <div className="card">
          <h2>Device Breakdown</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Users</th>
                  <th>Events</th>
                  <th>Time (min)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.deviceBreakdown || []).map((item) => (
                  <tr key={item.deviceType || 'unknown'}>
                    <td>{item.deviceType || 'unknown'}</td>
                    <td>{item.uniqueUsers}</td>
                    <td>{item.events}</td>
                    <td>{formatMinutes(item.totalDurationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Top Route Transitions</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Transitions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topTransitions || []).map((item, idx) => (
                  <tr key={`${item.from}-${item.to}-${idx}`}>
                    <td>{item.from}</td>
                    <td>{item.to}</td>
                    <td>{item.transitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mt-2">
        <h2>Campaign Attribution</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Medium</th>
                <th>Campaign</th>
                <th>Events</th>
                <th>Interactions</th>
                <th>Time (min)</th>
              </tr>
            </thead>
            <tbody>
              {(data?.campaigns || []).map((item, idx) => (
                <tr key={`${item.source}-${item.medium}-${item.campaign}-${idx}`}>
                  <td>{item.source || '-'}</td>
                  <td>{item.medium || '-'}</td>
                  <td>{item.campaign || '-'}</td>
                  <td>{item.events}</td>
                  <td>{item.interactions}</td>
                  <td>{formatMinutes(item.totalDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-2">
        <h2>Hourly Engagement (UTC)</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Events</th>
                <th>Time (min)</th>
              </tr>
            </thead>
            <tbody>
              {(data?.hourly || []).map((item) => (
                <tr key={item.hourUtc}>
                  <td>{String(item.hourUtc).padStart(2, '0')}:00</td>
                  <td>{item.events}</td>
                  <td>{formatMinutes(item.totalDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-2">
        <h2>Daily Activity</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Events</th>
                <th>Active Users</th>
                <th>Time (min)</th>
              </tr>
            </thead>
            <tbody>
              {(data?.daily || []).map((item) => (
                <tr key={item.day}>
                  <td>{item.day}</td>
                  <td>{item.events}</td>
                  <td>{item.activeUsers}</td>
                  <td>{formatMinutes(item.totalDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrackingAdmin;
