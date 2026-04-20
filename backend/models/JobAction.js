const mongoose = require('mongoose');

const jobActionSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actionType: { type: String, enum: ['applied', 'removed'], required: true, index: true },
    jobSignature: { type: String, required: true },
    jobId: { type: String, default: '' },
    source: { type: String, default: 'unknown' },
    title: { type: String, default: '' },
    company: { type: String, default: '' },
    location: { type: String, default: '' },
    url: { type: String, default: '' },
    salary: { type: String, default: '' },
    matchingScore: { type: Number, default: 0 },
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],
    actionDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

jobActionSchema.index({ candidate: 1, actionType: 1, jobSignature: 1 }, { unique: true });

module.exports = mongoose.model('JobAction', jobActionSchema);
