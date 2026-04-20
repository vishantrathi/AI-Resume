# JobMatch - AI Resume & Job Matching System

An intelligent web application that automatically matches candidates with suitable job opportunities using Natural Language Processing (NLP) and semantic similarity algorithms. Features real-time job discovery, a Python NLP microservice, and a professional SaaS-style dashboard.

**Live Features**: Real-time job scraping, semantic matching, skill gap analysis, candidate/recruiter dashboards, JWT authentication, Docker deployment.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Component Details](#component-details)
- [API Documentation](#api-documentation)
- [NLP Pipeline](#nlp-pipeline)
- [Data Models](#data-models)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Features

### Core Functionality

| Feature | Description |
|---------|-----------|
| **Resume Upload & Parsing** | Upload PDF/DOCX resumes; AI extracts skills, experience, education, certifications |
| **NLP Skill Extraction** | Tokenization, stop-word removal, named entity recognition (spaCy), keyword extraction |
| **Semantic Job Matching** | Cosine similarity scoring with sentence-transformers for deep semantic understanding |
| **Real-Time Job Discovery** | Auto-scrapes RemoteOK, LinkedIn, and other sources when DB jobs unavailable |
| **Skill Gap Analysis** | Visual breakdown of matched vs missing skills with learning recommendations |
| **Job Recommendations** | Ranked job listings based on resume match score (ML-powered scoring) |
| **Recruiter Dashboard** | Post jobs, browse candidates, filter by match score, compare profiles |
| **Candidate Dashboard** | Resume insights, top matches, skill cloud visualization, saved jobs |
| **JWT Authentication** | Secure login/register with rate limiting, input validation, token refresh |
| **Docker Support** | Complete stack deployable with docker-compose (5 services) |
| **Responsive Design** | Mobile-first Tailwind CSS, works on all devices |
| **Rate Limiting** | API rate limiting to prevent abuse (redis-backed) |

---

## Tech Stack

### Frontend Layer

| Technology | Version | Purpose |
|-----------|---------|---------|
| React.js | 19.2.4 | Component-based UI, hooks, context API |
| React Router | v6.30.3 | Client-side routing, nested routes |
| Tailwind CSS | v3.4.19 | Utility-first CSS framework for responsive design |
| Axios | 1.13.6 | HTTP client for API calls with interceptors |
| Framer Motion | 12.35.2 | Smooth animations and transitions |
| Recharts | 3.8.0 | Interactive charts for skill analysis |
| React Scripts | 5.0.1 | Create React App build tools |

### Backend Layer

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20-alpine | JavaScript runtime (Docker multi-stage) |
| Express.js | Latest | Lightweight web framework, REST APIs |
| MongoDB | Latest | NoSQL database for user, job, resume data |
| Mongoose | Latest | Object modeling for MongoDB |
| JWT | jsonwebtoken | Stateless authentication |
| bcryptjs | Latest | Password hashing |
| Multer | Latest | File upload middleware |
| pdf-parse | Latest | PDF text extraction |
| mammoth | Latest | DOCX text extraction |
| rate-limiter-flexible | Latest | Rate limiting middleware |
| Jest | Latest | Unit testing framework |

### NLP/AI Layer

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11-slim | Lightweight Python runtime |
| Flask | 3.0.0+ | Micro web framework for NLP APIs |
| Gunicorn | 21.2.0+ | WSGI HTTP server |
| NumPy | 1.26.0+ | Numerical computing |
| spaCy | 3.7.0+ | Named Entity Recognition, NLP pipelines |
| sentence-transformers | 2.7.0+ | Dense embeddings for semantic similarity |
| scikit-learn | Latest | Similarity metrics (cosine, Jaccard) |

### Infrastructure & DevOps

| Technology | Purpose |
|-----------|---------|
| Docker | Containerization of all services |
| Docker Compose | Multi-container orchestration |
| Nginx | Reverse proxy, SPA routing |
| Redis | In-memory cache, rate limiting, session store |

---

## System Architecture

### High-Level Overview

```
CLIENTS (Browser/Mobile)
        |
   Frontend SPA - Port 3000
   (React + Tailwind)
        |
  API GATEWAY (Express.js)
        |
   Port 5000
        |
    /auth  /resume  /jobs  /match  /candidate
        |
   Controllers + Middleware
        |
    +-----------+---------+---------+
    |           |         |         |
  MongoDB     Redis    Python NLP  Services
  Database    Cache    Flask (8000)
```

---

## Project Structure

```
ai-resume-job-matching/

BACKEND (Node.js/Express)
  +-- controllers/     # Business logic (auth, resume, job, match, scrape)
  +-- models/         # MongoDB schemas (User, Resume, Job, Match)
  +-- routes/         # API endpoints
  +-- middleware/     # Auth, upload, rate limiting
  +-- utils/          # NLP processor, matcher, scraper
  +-- services/       # External APIs (Google Jobs, RemoteOK)
  +-- tests/          # Jest unit tests (28 tests)
  +-- uploads/        # User resume files
  +-- Dockerfile      # Container config
  +-- package.json    # Dependencies
  +-- server.js       # Express entry point

FRONTEND (React/Tailwind)
  +-- src/
  ¦   +-- components/  # Navbar, PrivateRoute, TrackingManager
  ¦   +-- context/     # AuthContext (JWT + user state)
  ¦   +-- pages/       # Home, Dashboard, Upload, Recommendations
  ¦   +-- api.js       # Axios HTTP client
  ¦   +-- App.js       # Main router
  ¦   +-- index.js     # React DOM render
  +-- build/           # Production build
  +-- Dockerfile       # 2-stage build
  +-- tailwind.config.js
  +-- package.json
  +-- README.md

NLP SERVICE (Python/Flask)
  +-- app.py           # Flask endpoints
  +-- requirements.txt # Python dependencies
  +-- Dockerfile       # Python 3.11-slim
  +-- README.md

DOCKER SETUP
  +-- docker-compose.yml  # Orchestrates 5 services
  +-- .dockerignore files
```

---

## Getting Started

### Quick Start with Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/yourusername/ai-resume-job-matching
cd ai-resume-job-matching

# Start entire stack
docker-compose up --build

# Access services
# Frontend: http://localhost (or http://localhost:3000)
# Backend API: http://localhost:5000
# NLP Service: http://localhost:8000
```

### Manual Setup - Backend

```bash
cd backend
npm install

# Create .env file
cat > .env << 'EOF'
PORT=5000
MONGO_URI=mongodb://localhost:27017/ai_resume_matching
JWT_SECRET=your_long_random_secret_here
REDIS_URL=redis://localhost:6379
NLP_SERVICE_URL=http://localhost:8000
NODE_ENV=development
EOF

npm start                    # Production mode
npm run dev                  # Development with nodemon
npm test                     # Run tests
```

### Manual Setup - NLP Service

```bash
cd nlp-service
python -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python app.py
```

### Manual Setup - Frontend

```bash
cd frontend
npm install
npm run dev                 # Development server (port 3000)
npm run build               # Production build
npm test                    # Run tests
```

---

## Component Details

### Frontend Components

#### Navbar Component
- Purpose: Site-wide navigation and authentication UI
- Features: Mobile-responsive menu, user profile, logout
- Props: user (from AuthContext)

#### AuthContext
- Purpose: Global JWT token and user state management
- Provides: user, token, isAuthenticated, loading, error
- Methods: login(), register(), logout(), refreshToken()

#### PrivateRoute Component
- Purpose: Route protection middleware
- Behavior: Redirects unauthenticated users to /login

#### Pages

| Page | Route | Access | Purpose |
|------|-------|--------|---------|
| Home | / | Public | Landing page, features |
| Login | /login | Public | Email/password auth |
| Register | /register | Public | New account creation |
| ResumeUpload | /upload | Private | PDF/DOCX upload |
| JobRecommendations | /recommendations | Private | Ranked matches |
| SkillAnalysis | /skills | Private | Skill gap visualization |
| CandidateDashboard | /candidate-dashboard | Private | Resume summary |
| RecruiterDashboard | /recruiter-dashboard | Private | Posted jobs |
| JobList | /jobs | Private | Browse all jobs |
| PostJob | /post-job | Private | Create job post |
| SavedJobs | /saved-jobs | Private | User bookmarks |
| CareerRoadmap | /career-roadmap | Private | Growth suggestions |
| AccountSettings | /settings | Private | Profile & preferences |

### Backend Controllers

#### authController.js
- register(): Hash password -> Create user -> JWT token
- login(): Verify password -> JWT token
- getProfile(): Return authenticated user data
- logout(): Client-side token removal

#### resumeController.js
- uploadResume(): Validate -> Store -> Extract -> Parse -> Save
- getResume(): Fetch user's parsed resume
- deleteResume(): Remove resume

#### jobController.js
- getJobs(): List jobs with pagination/filters
- createJob(): Recruiter posts job
- updateJob(): Edit job posting
- deleteJob(): Remove job
- searchJobs(): Full-text search

#### matchController.js
- computeMatches(): Get resume + jobs -> Score -> Rank
- getMatchDetails(): Detailed breakdown for one match

#### scrapeController.js
- triggerScrape(): Start web scraping
- getScrapedJobs(): Fetch discovered jobs
- syncScrapedJobs(): Store jobs

### Backend Middleware

#### auth.js (JWT Verification)
- Verifies token in request headers
- Decodes and attaches user to request
- Returns 401 if invalid/expired

#### rateLimiter.js (Redis-backed)
- Limits: 5 login attempts per 15 minutes
- General API: 100 requests per minute
- Uses redis-rate-limiter-flexible

#### upload.js (Multer Configuration)
- File limits: 10MB max
- Allowed types: PDF, DOCX
- Destination: /uploads/

### Backend Services

#### nlpProcessor.js (Node.js)
```
processText(text):
  - Tokenize
  - Remove stopwords
  - Extract skills (vs 150+ taxonomy)
  - Parse sections (Experience, Education)
  - Return structured data
```

#### matcher.js (Hybrid Scoring)
```
scoreMatch(resume, job):
  - Semantic: cosineSimilarity(embeddings) = 0-1
  - Skills: jaccard(skills) = 0-1
  - Final: 0.8 * semantic + 0.2 * skills
  - Return: 0-100%
```

---

## API Documentation

### Authentication

```bash
# Register
POST /api/auth/register
{
  "name": "John Candidate",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "candidate"
}
Response: 201 Created
{ "token": "jwt...", "user": {...} }

# Login
POST /api/auth/login
{ "email": "john@example.com", "password": "SecurePass123!" }
Response: { "token": "jwt...", "user": {...} }

# Get Profile
GET /api/auth/profile
Authorization: Bearer <JWT>
Response: { "id": "...", "email": "...", "role": "..." }
```

### Resume Management

```bash
# Upload Resume
POST /api/resume/upload
Authorization: Bearer <JWT>
Content-Type: multipart/form-data
file: <PDF or DOCX>

Response: 201 Created
{ "resumeId": "...", "skills": [...], "experience": [...] }

# Get Resume
GET /api/resume/me
Response: { "resumeId": "...", "skills": [...] }
```

### Job Management

```bash
# Get All Jobs
GET /api/jobs?page=1&limit=10&location=India
Response: { "total": 150, "jobs": [...] }

# Post Job
POST /api/jobs
{ "title": "React Developer", "company": "TechCorp", ... }

# Get Recommendations
GET /api/jobs/recommendations?limit=10
Response: { "recommendations": [...] }

# Skill Gap Analysis
GET /api/candidate/skill-gap/:jobId
Response: {
  "matchedSkills": [...],
  "missingSkills": [...],
  "learningResources": [...]
}
```

---

## NLP Pipeline

### Resume Parsing Flow

```
Raw Resume Text
      |
Tokenization
      |
Stop-word Removal
      |
Skill Extraction (vs 150+ skills)
      |
Section Detection (Experience, Education)
      |
Named Entity Recognition (spaCy)
      |
Structured Resume Data -> MongoDB
```

### Semantic Matching

```
Resume Features + Job Features
      |
Generate Embeddings (sentence-transformers)
      |
Cosine Similarity (0-1 range)
      |
Skill Overlap (Jaccard, 0-1 range)
      |
Hybrid Score: 0.8*Semantic + 0.2*Skill
      |
Final Match Score (0-100%)
```

---

## Data Models

### User Schema
```
_id: ObjectId
name: String
email: String (unique)
password: String (hashed)
role: Enum [candidate, recruiter]
profilePicture: String
bio: String
phone: String
location: String
skills: [String]
experience: Number (years)
resumeId: ObjectId (ref: Resume)
savedJobs: [ObjectId] (ref: Job)
appliedJobs: [ObjectId] (ref: Job)
createdAt: Date
updatedAt: Date
```

### Resume Schema
```
_id: ObjectId
userId: ObjectId
rawText: String
skills: [{ name, proficiency, yearsOfExperience }]
experience: [{ company, position, startDate, endDate, description }]
education: [{ institution, degree, field, graduationYear }]
certifications: [{ name, issuer, issueDate, expiryDate }]
fileUrl: String (path to uploaded file)
uploadedAt: Date
updatedAt: Date
```

### Job Schema
```
_id: ObjectId
recruiterId: ObjectId
title: String
company: String
description: String
location: String
jobType: Enum [Full-time, Part-time, Contract, Freelance]
salaryMin: Number
salaryMax: Number
skillsRequired: [String]
experienceRequired: Number (years)
requirements: [String]
benefits: [String]
applicationDeadline: Date
status: Enum [active, closed, on-hold]
postedAt: Date
updatedAt: Date
```

### Match Schema
```
_id: ObjectId
candidateId: ObjectId
jobId: ObjectId
matchScore: Number (0-100)
semanticSimilarity: Number (0-1)
skillOverlap: Number (0-1)
matchedSkills: [String]
missingSkills: [String]
computedAt: Date
```

---

## Environment Configuration

### Backend .env

```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/ai_resume_matching
JWT_SECRET=your_very_long_random_secret_key_min_32_characters
JWT_EXPIRE=7d
REDIS_URL=redis://localhost:6379
NLP_SERVICE_URL=http://localhost:8000
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3000
```

### Frontend .env

```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENVIRONMENT=development
```

### NLP Service .env

```
PORT=8000
DEBUG=True
FLASK_ENV=development
GUNICORN_WORKERS=2
```

---

## Deployment

### Docker Deployment

```bash
# Build and start
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Cloud Deployment Options

Frontend:
- Vercel: Auto-deploy from GitHub
- Netlify: Drop-in deployment
- AWS S3 + CloudFront

Backend:
- Render.com: Git-connected Node.js hosting
- Railway: Docker-native platform
- AWS EC2 / Heroku

Database:
- MongoDB Atlas (Cloud)
- AWS DocumentDB
- Azure Cosmos DB

---

## Testing

```bash
cd backend

# Run all tests
npm test

# Specific test file
npm test -- matcher.test.js

# Coverage report
npm test -- --coverage
```

### Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| matcher.test.js | 8 | 95% |
| nlpProcessor.test.js | 6 | 90% |
| career.test.js | 7 | 85% |
| enhanced.test.js | 7 | 80% |

---

## Troubleshooting

### MongoDB Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:27017

Solution:
1. Start MongoDB: mongod (Mac) or mongod.exe (Windows)
2. Or use MongoDB Atlas: Update MONGO_URI in .env
```

### Port Already in Use

```
Error: listen EADDRINUSE :::5000

Solution (Unix/Mac):
lsof -i :5000
kill -9 <PID>

Solution (Windows):
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### NLP Service Not Responding

```
Error: Cannot reach http://localhost:8000

Solution:
1. Ensure Python service is running: python app.py
2. Check firewall/network issues
3. Verify NLP_SERVICE_URL in .env
```

### Resume Upload Failing

```
Error: File size exceeds limit

Solution:
1. Increase MAX_FILE_SIZE in .env
2. Ensure /backend/uploads/ directory exists
3. Check disk space availability
```

### Docker Build Fails

```
Solution:
docker-compose down
docker system prune -a
docker-compose up --build
```

---

## Contributing

### Development Workflow

```bash
# Fork & Clone
git clone https://github.com/yourusername/ai-resume-job-matching
cd ai-resume-job-matching

# Create Feature Branch
git checkout -b feature/your-feature-name

# Make Changes & Commit
git add .
git commit -m "feat: Add your feature description"

# Push & Create PR
git push origin feature/your-feature-name
```

### Code Standards

- Frontend: ESLint + Prettier (React best practices)
- Backend: ESLint + Jest (unit tests)
- Python: PEP 8 + type hints

### Commit Message Format

```
feat: Add new feature
fix: Fix bug description
docs: Update documentation
test: Add/update tests
refactor: Code refactoring
```

---

## License

MIT License - See LICENSE file

---

## Support

Issues: https://github.com/yourusername/ai-resume-job-matching/issues
Email: support@jobmatch.com

---

Version: 2.0.0
Last Updated: April 2026
Maintainer: Development Team
