const mongoose = require('mongoose');

const scrapedJobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, default: '', trim: true },
    location: { type: String, default: '' },
    salary: { type: String, default: '' },
    experience: { type: String, default: '' },
    description: { type: String, default: '' },
    requiredSkills: [{ type: String }],
    url: { type: String, default: '' },
    source: { type: String, default: 'remoteok' },
    externalId: { type: String, default: '' },
    postedDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent duplicate jobs from the same source
scrapedJobSchema.index({ externalId: 1, source: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ScrapedJob', scrapedJobSchema);
