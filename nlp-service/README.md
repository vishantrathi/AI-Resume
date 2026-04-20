# NLP Microservice

Python Flask microservice providing advanced NLP capabilities for the AI Resume Matching System.

## Features

- **Resume Parsing** — extract skills, experience, education, projects using NLP
- **Named Entity Recognition** — spaCy-powered entity detection
- **Semantic Matching** — sentence-transformers (all-MiniLM-L6-v2) for cosine similarity scoring
- **Skill Extraction** — curated keyword matching + spaCy NER
- **Job Page Scraping** — Scrapling-powered extraction from live job URLs

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/parse-resume` | Parse resume text into structured data |
| POST | `/extract-skills` | Extract skills from any text |
| POST | `/match` | Compute semantic similarity scores |
| POST | `/scrape-job-pages` | Scrape job URLs and extract title/description/skills |

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Download spaCy English model
python -m spacy download en_core_web_sm

# Start the service
python app.py
```

## Docker

```bash
docker build -t nlp-service .
docker run -p 8000:8000 nlp-service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Port to listen on |
| `DEBUG` | `false` | Enable Flask debug mode |

## API Examples

### Parse Resume

```bash
curl -X POST http://localhost:8000/parse-resume \
  -H "Content-Type: application/json" \
  -d '{"text": "Python developer with 3 years experience in Django and PostgreSQL"}'
```

### Match Jobs

```bash
curl -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{
    "resume_text": "Python Django developer",
    "jobs": [
      {"id": "1", "title": "Backend Dev", "description": "Python Django PostgreSQL", "requiredSkills": ["Python", "Django"]}
    ]
  }'
```

### Scrape Job Pages

```bash
curl -X POST http://localhost:8000/scrape-job-pages \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/jobs/1",
      "https://example.com/jobs/2"
    ],
    "max_text_chars": 4000
  }'
```
