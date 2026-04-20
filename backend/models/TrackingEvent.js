const mongoose = require('mongoose');

const sectionStatSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    durationMs: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const clickTargetSchema = new mongoose.Schema(
  {
    target: { type: String, required: true },
    count: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const trackingEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    route: { type: String, required: true, index: true },
    durationMs: { type: Number, required: true, min: 0 },
    sectionDurations: { type: [sectionStatSchema], default: [] },
    primarySection: { type: String, default: '' },
    maxScrollDepth: { type: Number, default: 0, min: 0, max: 100 },
    interactionCount: { type: Number, default: 0, min: 0 },
    keypressCount: { type: Number, default: 0, min: 0 },
    mouseDistancePx: { type: Number, default: 0, min: 0 },
    clickTargets: { type: [clickTargetSchema], default: [] },
    viewport: {
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    routeFrom: { type: String, default: '' },
    referrer: { type: String, default: '' },
    utmSource: { type: String, default: '' },
    utmMedium: { type: String, default: '' },
    utmCampaign: { type: String, default: '' },
    deviceType: { type: String, default: 'unknown' },
    platform: { type: String, default: '' },
    timezone: { type: String, default: '' },
    connectionType: { type: String, default: '' },
    connectionDownlink: { type: Number, default: 0, min: 0 },
    connectionRtt: { type: Number, default: 0, min: 0 },
    anonymousId: { type: String, default: '', index: true },
    userAgent: { type: String, default: '' },
    language: { type: String, default: '' },
    consentVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

trackingEventSchema.index({ user: 1, createdAt: -1 });
trackingEventSchema.index({ createdAt: -1, route: 1 });

module.exports = mongoose.model('TrackingEvent', trackingEventSchema);
