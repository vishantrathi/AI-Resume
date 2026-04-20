const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    matchingScore: { type: Number, default: 0 },
    skillMatchScore: { type: Number, default: 0 },
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);
