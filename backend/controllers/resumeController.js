const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Resume = require('../models/Resume');
const { parseResume } = require('../utils/nlpProcessor');

/**
 * Extract raw text from an uploaded file (PDF or DOCX).
 */
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return '';
}

// POST /api/resume/upload
const uploadResume = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let rawText = '';
  try {
    rawText = await extractText(req.file.path, req.file.originalname);
  } catch (err) {
    // Clean up the file even if extraction fails
    fs.unlink(req.file.path, () => {});
    return res.status(422).json({ message: 'Failed to extract text from file', error: err.message });
  }

  const parsed = parseResume(rawText);

  // Upsert: one resume per candidate (replace previous)
  const resume = await Resume.findOneAndUpdate(
    { candidate: req.user.id },
    {
      candidate: req.user.id,
      fileName: req.file.originalname,
      ...parsed,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Clean up uploaded file from disk after parsing
  fs.unlink(req.file.path, () => {});

  res.status(201).json({ message: 'Resume uploaded and parsed successfully', resume });
};

// GET /api/resume/me
const getMyResume = async (req, res) => {
  const resume = await Resume.findOne({ candidate: req.user.id });
  if (!resume) return res.status(404).json({ message: 'No resume found' });
  res.json(resume);
};

// GET /api/resume/:id  (recruiter can view any resume)
const getResumeById = async (req, res) => {
  const resume = await Resume.findById(req.params.id).populate('candidate', 'name email');
  if (!resume) return res.status(404).json({ message: 'Resume not found' });
  res.json(resume);
};

// GET /api/resume/all  (recruiter only)
const getAllResumes = async (_req, res) => {
  const resumes = await Resume.find().populate('candidate', 'name email').sort({ updatedAt: -1 });
  res.json(resumes);
};

module.exports = { uploadResume, getMyResume, getResumeById, getAllResumes };
