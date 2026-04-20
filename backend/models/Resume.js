const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    rawText: { type: String, default: '' },
    skills: [{ type: String }],
    experience: [{ type: String }],
    education: [{ type: String }],
    certifications: [{ type: String }],
    projects: [{ type: String }],
    summary: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);
