const TrackingEvent = require('../models/TrackingEvent');

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function computeStreak(dayKeys) {
  if (dayKeys.size === 0) return 0;

  let streak = 0;
  let cursor = startOfUtcDay(new Date());

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dayKeys.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

const ingestTrackingEvent = async (req, res) => {
  const {
    sessionId,
    route,
    durationMs,
    sectionDurations,
    maxScrollDepth,
    interactionCount,
    keypressCount,
    mouseDistancePx,
    clickTargets,
    viewport,
    routeFrom,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    deviceType,
    platform,
    timezone,
    connectionType,
    connectionDownlink,
    connectionRtt,
    anonymousId,
    userAgent,
    language,
    consentVersion,
  } = req.body || {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ message: 'sessionId is required' });
  }
  if (!route || typeof route !== 'string') {
    return res.status(400).json({ message: 'route is required' });
  }
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs) || durationMs < 0) {
    return res.status(400).json({ message: 'durationMs must be a non-negative number' });
  }

  const sections = Object.entries(sectionDurations || {})
    .filter(([name, ms]) => typeof name === 'string' && name.trim().length > 0 && typeof ms === 'number' && ms > 0)
    .map(([name, ms]) => ({ name: name.trim().slice(0, 120), durationMs: Math.round(ms) }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 50);

  const primarySection = sections.length > 0 ? sections[0].name : '';

  const targetStats = Array.isArray(clickTargets)
    ? clickTargets
      .filter((item) => typeof item?.target === 'string' && item.target.trim().length > 0 && Number(item.count) > 0)
      .map((item) => ({
        target: item.target.trim().slice(0, 200),
        count: Math.max(1, Math.round(Number(item.count))),
      }))
      .slice(0, 30)
    : [];

  const doc = await TrackingEvent.create({
    user: req.user.id,
    sessionId: sessionId.slice(0, 120),
    route: route.slice(0, 220),
    durationMs: Math.round(durationMs),
    sectionDurations: sections,
    primarySection,
    maxScrollDepth: Math.max(0, Math.min(100, Number(maxScrollDepth) || 0)),
    interactionCount: Math.max(0, Number(interactionCount) || 0),
    keypressCount: Math.max(0, Number(keypressCount) || 0),
    mouseDistancePx: Math.max(0, Math.round(Number(mouseDistancePx) || 0)),
    clickTargets: targetStats,
    viewport: {
      width: Math.max(0, Number(viewport?.width) || 0),
      height: Math.max(0, Number(viewport?.height) || 0),
    },
    routeFrom: String(routeFrom || '').slice(0, 220),
    referrer: String(referrer || '').slice(0, 350),
    utmSource: String(utmSource || '').slice(0, 80),
    utmMedium: String(utmMedium || '').slice(0, 80),
    utmCampaign: String(utmCampaign || '').slice(0, 120),
    deviceType: String(deviceType || 'unknown').slice(0, 24),
    platform: String(platform || '').slice(0, 120),
    timezone: String(timezone || '').slice(0, 120),
    connectionType: String(connectionType || '').slice(0, 40),
    connectionDownlink: Math.max(0, Number(connectionDownlink) || 0),
    connectionRtt: Math.max(0, Number(connectionRtt) || 0),
    anonymousId: String(anonymousId || '').slice(0, 120),
    userAgent: String(userAgent || '').slice(0, 400),
    language: String(language || '').slice(0, 40),
    consentVersion: String(consentVersion || 'v1').slice(0, 20),
  });

  res.status(201).json({ id: doc._id });
};

const getMyTrackingSummary = async (req, res) => {
  const now = new Date();
  const last60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [events60, events30] = await Promise.all([
    TrackingEvent.find({ user: req.user.id, createdAt: { $gte: last60 } })
      .select('createdAt durationMs route sectionDurations maxScrollDepth interactionCount'),
    TrackingEvent.find({ user: req.user.id, createdAt: { $gte: last30 } })
      .select('durationMs route sectionDurations maxScrollDepth interactionCount'),
  ]);

  const dayKeys = new Set(events60.map((e) => e.createdAt.toISOString().slice(0, 10)));
  const currentStreakDays = computeStreak(dayKeys);

  const totalDurationMs = events30.reduce((sum, e) => sum + (e.durationMs || 0), 0);
  const totalInteractions = events30.reduce((sum, e) => sum + (e.interactionCount || 0), 0);
  const avgScrollDepth = events30.length === 0
    ? 0
    : Math.round(events30.reduce((sum, e) => sum + (e.maxScrollDepth || 0), 0) / events30.length);

  const routeTotals = new Map();
  const sectionTotals = new Map();
  for (const event of events30) {
    routeTotals.set(event.route, (routeTotals.get(event.route) || 0) + (event.durationMs || 0));
    for (const sec of event.sectionDurations || []) {
      sectionTotals.set(sec.name, (sectionTotals.get(sec.name) || 0) + (sec.durationMs || 0));
    }
  }

  const topRoutes = [...routeTotals.entries()]
    .map(([route, durationMs]) => ({ route, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 8);

  const topSections = [...sectionTotals.entries()]
    .map(([section, durationMs]) => ({ section, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  res.json({
    currentStreakDays,
    totalTrackedMinutes30d: Math.round(totalDurationMs / 60000),
    totalInteractions30d: totalInteractions,
    avgScrollDepth30d: avgScrollDepth,
    topRoutes,
    topSections,
  });
};

const getAdminTrackingOverview = async (req, res) => {
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalsAgg,
    topRoutesAgg,
    topSectionsAgg,
    dailyAgg,
    topReferrersAgg,
    topClickTargetsAgg,
    deviceBreakdownAgg,
    hourlyAgg,
    topTransitionsAgg,
    campaignAgg,
  ] = await Promise.all([
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
          totalInteractions: { $sum: '$interactionCount' },
          avgScrollDepth: { $avg: '$maxScrollDepth' },
          uniqueUsers: { $addToSet: '$user' },
        },
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          totalDurationMs: 1,
          totalInteractions: 1,
          avgScrollDepth: { $round: ['$avgScrollDepth', 0] },
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: '$route',
          events: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
          avgScrollDepth: { $avg: '$maxScrollDepth' },
        },
      },
      { $sort: { totalDurationMs: -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          route: '$_id',
          events: 1,
          totalDurationMs: 1,
          avgScrollDepth: { $round: ['$avgScrollDepth', 0] },
        },
      },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      { $unwind: '$sectionDurations' },
      {
        $group: {
          _id: '$sectionDurations.name',
          totalDurationMs: { $sum: '$sectionDurations.durationMs' },
          events: { $sum: 1 },
        },
      },
      { $sort: { totalDurationMs: -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          section: '$_id',
          totalDurationMs: 1,
          events: 1,
        },
      },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          totalDurationMs: { $sum: '$durationMs' },
          events: { $sum: 1 },
          users: { $addToSet: '$user' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          day: '$_id',
          events: 1,
          totalDurationMs: 1,
          activeUsers: { $size: '$users' },
        },
      },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 }, referrer: { $ne: '' } } },
      {
        $group: {
          _id: '$referrer',
          events: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
        },
      },
      { $sort: { events: -1 } },
      { $limit: 12 },
      { $project: { _id: 0, referrer: '$_id', events: 1, totalDurationMs: 1 } },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      { $unwind: '$clickTargets' },
      {
        $group: {
          _id: '$clickTargets.target',
          totalClicks: { $sum: '$clickTargets.count' },
          events: { $sum: 1 },
        },
      },
      { $sort: { totalClicks: -1 } },
      { $limit: 15 },
      { $project: { _id: 0, target: '$_id', totalClicks: 1, events: 1 } },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: '$deviceType',
          events: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
          users: { $addToSet: '$user' },
        },
      },
      { $sort: { events: -1 } },
      {
        $project: {
          _id: 0,
          deviceType: '$_id',
          events: 1,
          totalDurationMs: 1,
          uniqueUsers: { $size: '$users' },
        },
      },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          events: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hourUtc: '$_id', events: 1, totalDurationMs: 1 } },
    ]),
    TrackingEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: last30 },
          routeFrom: { $ne: '' },
        },
      },
      {
        $group: {
          _id: { from: '$routeFrom', to: '$route' },
          transitions: { $sum: 1 },
        },
      },
      { $sort: { transitions: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 0,
          from: '$_id.from',
          to: '$_id.to',
          transitions: 1,
        },
      },
    ]),
    TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: last30 }, utmCampaign: { $ne: '' } } },
      {
        $group: {
          _id: {
            source: '$utmSource',
            medium: '$utmMedium',
            campaign: '$utmCampaign',
          },
          events: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
          interactions: { $sum: '$interactionCount' },
        },
      },
      { $sort: { events: -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          source: '$_id.source',
          medium: '$_id.medium',
          campaign: '$_id.campaign',
          events: 1,
          totalDurationMs: 1,
          interactions: 1,
        },
      },
    ]),
  ]);

  const totals = totalsAgg[0] || {
    totalEvents: 0,
    totalDurationMs: 0,
    totalInteractions: 0,
    avgScrollDepth: 0,
    uniqueUsers: 0,
  };

  res.json({
    rangeDays: 30,
    totals: {
      ...totals,
      totalTrackedMinutes: Math.round((totals.totalDurationMs || 0) / 60000),
    },
    topRoutes: topRoutesAgg,
    topSections: topSectionsAgg,
    daily: dailyAgg,
    topReferrers: topReferrersAgg,
    topClickTargets: topClickTargetsAgg,
    deviceBreakdown: deviceBreakdownAgg,
    hourly: hourlyAgg,
    topTransitions: topTransitionsAgg,
    campaigns: campaignAgg,
  });
};

module.exports = {
  ingestTrackingEvent,
  getMyTrackingSummary,
  getAdminTrackingOverview,
};
