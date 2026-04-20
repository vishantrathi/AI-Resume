"""
AI NLP Microservice
===================
Flask-based REST API for advanced resume processing and semantic job matching.

Endpoints:
  POST /parse-resume    — Extract skills, entities, and embeddings from resume text
  POST /match           — Compute semantic similarity between resume and job descriptions
  POST /extract-skills  — Extract skills from arbitrary text
    POST /scrape-job-pages — Scrape job page URLs and extract structured content
  GET  /health          — Health check
"""

import os
import re
import json
from html import unescape
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen
from functools import lru_cache

from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Optional heavy dependencies (spaCy + sentence-transformers).
# We import them lazily so the service can still start if they are not
# installed, and we return a graceful error in that case.
# ---------------------------------------------------------------------------

try:
    import spacy
    nlp_model = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    nlp_model = None
    SPACY_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer, util
    _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    TRANSFORMERS_AVAILABLE = True
except Exception:
    _embedder = None
    TRANSFORMERS_AVAILABLE = False

try:
    from scrapling.parser import Selector
    SCRAPLING_AVAILABLE = True
except Exception:
    Selector = None
    SCRAPLING_AVAILABLE = False

# ---------------------------------------------------------------------------
# Curated skill keyword list (mirrors the Node.js NLP processor)
# ---------------------------------------------------------------------------

SKILL_KEYWORDS = [
    # Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "ruby", "go",
    "golang", "rust", "swift", "kotlin", "php", "scala", "r", "matlab",
    "perl", "haskell", "elixir", "dart", "bash", "shell", "powershell",
    # Frontend
    "react", "reactjs", "angular", "angularjs", "vue", "vuejs", "html",
    "html5", "css", "css3", "sass", "less", "tailwind", "bootstrap",
    "jquery", "redux", "webpack", "vite", "nextjs", "next.js", "gatsby",
    "svelte", "ember",
    # Backend
    "node", "nodejs", "node.js", "express", "expressjs", "django", "flask",
    "fastapi", "spring", "spring boot", "rails", "laravel", "asp.net",
    "nestjs", "nest.js",
    # Databases
    "mongodb", "mysql", "postgresql", "postgres", "sqlite", "redis",
    "elasticsearch", "cassandra", "dynamodb", "firebase",
    # Cloud & DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
    "jenkins", "ci/cd", "terraform", "ansible", "nginx", "linux", "git",
    "github", "gitlab",
    # APIs & protocols
    "rest", "restful", "graphql", "grpc", "websocket", "jwt", "oauth",
    # AI / ML / Data
    "machine learning", "deep learning", "nlp", "natural language processing",
    "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn", "pandas",
    "numpy", "transformers", "bert", "gpt", "llm", "data science",
    "data engineering", "spark", "hadoop", "kafka", "airflow", "tableau",
    # Testing
    "jest", "mocha", "pytest", "junit", "selenium", "cypress", "playwright",
    # Patterns
    "microservices", "serverless", "mvc", "agile", "scrum", "devops",
    "oop", "tdd", "bdd",
    # Other
    "sql", "nosql", "api", "blockchain", "solidity", "web3", "figma",
]

# Sort multi-word skills to be checked first
MULTI_WORD_SKILLS = [s for s in SKILL_KEYWORDS if " " in s or "." in s]
SINGLE_WORD_SKILLS = [s for s in SKILL_KEYWORDS if " " not in s and "." not in s]

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "i", "we", "you", "he", "she",
    "it", "they", "me", "him", "her", "us", "them", "this", "that",
    "these", "those", "what", "which", "who", "when", "where", "why",
    "how", "all", "both", "each", "few", "more", "most", "no", "not",
    "only", "so", "than", "too", "very", "just", "also", "as", "if",
}


# ---------------------------------------------------------------------------
# Skill extraction helpers
# ---------------------------------------------------------------------------

def extract_skills(text: str) -> list[str]:
    """Extract skills from text using keyword matching."""
    if not text:
        return []
    lower = text.lower()

    found = set()
    for skill in MULTI_WORD_SKILLS:
        if skill in lower:
            found.add(skill)

    tokens = set(re.sub(r"[^a-z0-9#+\s]", " ", lower).split())
    tokens -= STOP_WORDS
    for skill in SINGLE_WORD_SKILLS:
        if skill in tokens:
            found.add(skill)

    # Capitalise output
    UPPER_ACRONYMS = {"html", "css", "sql", "api", "json", "aws", "gcp",
                      "jwt", "rest", "grpc", "nlp", "llm", "bert", "gpt", "k8s"}
    result = []
    for s in sorted(found):
        if s.lower() in UPPER_ACRONYMS:
            result.append(s.upper())
        else:
            result.append(s.title())
    return result


def normalize_ws(text: str) -> str:
    """Collapse repeated whitespace and trim edges."""
    return re.sub(r"\s+", " ", text or "").strip()


def extract_page_text_fallback(html: str) -> str:
    """Basic HTML-to-text fallback when Scrapling is not available."""
    no_script = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    no_style = re.sub(r"<style[\s\S]*?</style>", " ", no_script, flags=re.I)
    no_tags = re.sub(r"<[^>]+>", " ", no_style)
    return normalize_ws(unescape(no_tags))


def fetch_url_html(url: str, timeout_sec: int = 12) -> str:
    """Fetch URL content with browser-like headers."""
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(req, timeout=timeout_sec) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def scrape_job_page(url: str, max_text_chars: int = 4000) -> dict:
    """Extract title/description/skills from a job page URL."""
    if not url or not isinstance(url, str):
        return {"url": url or "", "error": "Invalid URL"}

    try:
        html = fetch_url_html(url)
    except (HTTPError, URLError, TimeoutError, ValueError) as err:
        return {"url": url, "error": f"Fetch failed: {err}"}
    except Exception as err:
        return {"url": url, "error": f"Unexpected fetch error: {err}"}

    title = ""
    description = ""
    text_blob = ""

    if SCRAPLING_AVAILABLE and Selector is not None:
        try:
            page = Selector(html)
            title = normalize_ws(page.css("title::text").get() or page.css("h1::text").get() or "")

            desc_candidates = [
                page.css('meta[name="description"]::attr(content)').get() or "",
                page.css('meta[property="og:description"]::attr(content)').get() or "",
                page.css("[data-testid*='description']::text").get() or "",
                page.css("article p::text").get() or "",
                page.css("main p::text").get() or "",
            ]
            description = normalize_ws(next((d for d in desc_candidates if d and d.strip()), ""))

            chunks = page.css("body::text").getall() or []
            text_blob = normalize_ws(" ".join(chunks))
        except Exception:
            # If Scrapling parsing fails for a specific page, fall back to regex text extraction.
            text_blob = extract_page_text_fallback(html)
    else:
        text_blob = extract_page_text_fallback(html)

    if not description:
        description = text_blob[:1200]

    combined = normalize_ws(f"{title} {description} {text_blob[:max_text_chars]}")
    skills = extract_skills(combined)

    return {
        "url": url,
        "title": title,
        "description": description[:2000],
        "skills": skills,
        "text": text_blob[:max_text_chars],
    }


def spacy_extract_entities(text: str) -> dict:
    """Use spaCy to extract named entities (ORG, GPE, DATE, etc.)."""
    if not SPACY_AVAILABLE or not nlp_model:
        return {}
    doc = nlp_model(text[:10000])  # Limit to avoid memory issues
    entities = {}
    for ent in doc.ents:
        label = ent.label_
        if label not in entities:
            entities[label] = []
        if ent.text not in entities[label]:
            entities[label].append(ent.text)
    return entities


def generate_summary(text: str, max_chars: int = 300) -> str:
    """Generate a brief summary from the first meaningful lines."""
    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 20]
    return " ".join(lines[:3])[:max_chars]


def extract_sections(text: str) -> dict:
    """Parse resume into sections using heading detection."""
    sections = {"experience": [], "education": [], "certifications": [], "projects": []}
    patterns = {
        "experience": re.compile(r"^(work\s+)?experience|employment|work\s+history", re.I),
        "education": re.compile(r"^education|academic|qualifications?", re.I),
        "certifications": re.compile(r"^certifications?|certificates?|courses?|training", re.I),
        "projects": re.compile(r"^projects?|portfolio", re.I),
    }
    current = None
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        matched = False
        for section, pattern in patterns.items():
            if pattern.match(line):
                current = section
                matched = True
                break
        if not matched and current and len(line) > 3:
            sections[current].append(line)
    for key in sections:
        sections[key] = sections[key][:10]
    return sections


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

def get_embedding(text: str):
    """Return a sentence embedding vector for the given text."""
    if not TRANSFORMERS_AVAILABLE or _embedder is None:
        return None
    return _embedder.encode(text, convert_to_tensor=False).tolist()


def cosine_similarity_score(vec_a, vec_b) -> float:
    """Compute cosine similarity between two embedding vectors."""
    if not TRANSFORMERS_AVAILABLE or _embedder is None:
        return 0.0
    import numpy as np
    a = np.array(vec_a)
    b = np.array(vec_b)
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "spacy": SPACY_AVAILABLE,
        "transformers": TRANSFORMERS_AVAILABLE,
        "scrapling": SCRAPLING_AVAILABLE,
    })


@app.post("/scrape-job-pages")
def scrape_job_pages_endpoint():
    """
    Scrape one or more job page URLs and extract structured content.

    Request body:
    {
      "urls": ["https://...", "https://..."],
      "max_text_chars": 4000
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    urls = body.get("urls", [])
    max_text_chars = int(body.get("max_text_chars", 4000))
    max_text_chars = max(500, min(max_text_chars, 12000))

    if not isinstance(urls, list) or len(urls) == 0:
        return jsonify({"error": "urls must be a non-empty array"}), 400

    # Keep endpoint bounded to protect service latency.
    urls = urls[:25]

    results = [scrape_job_page(url, max_text_chars=max_text_chars) for url in urls]
    return jsonify({
        "results": results,
        "scrapling": SCRAPLING_AVAILABLE,
    })


@app.post("/parse-resume")
def parse_resume():
    """
    Parse raw resume text and return structured data.

    Request body: { "text": "<raw resume text>" }
    Response:     { skills, experience, education, certifications,
                    projects, summary, entities, embedding (optional) }
    """
    body = request.get_json(force=True, silent=True) or {}
    text = body.get("text", "")
    if not text:
        return jsonify({"error": "text field is required"}), 400

    skills = extract_skills(text)
    sections = extract_sections(text)
    summary = generate_summary(text)
    entities = spacy_extract_entities(text) if SPACY_AVAILABLE else {}

    response = {
        "skills": skills,
        "experience": sections["experience"],
        "education": sections["education"],
        "certifications": sections["certifications"],
        "projects": sections["projects"],
        "summary": summary,
        "entities": entities,
        "rawText": text,
    }

    # Optionally include embedding (can be large — only if requested)
    if body.get("include_embedding") and TRANSFORMERS_AVAILABLE:
        response["embedding"] = get_embedding(text)

    return jsonify(response)


@app.post("/extract-skills")
def extract_skills_endpoint():
    """
    Extract skills from text.

    Request body: { "text": "<text>" }
    Response:     { "skills": ["Python", "React", ...] }
    """
    body = request.get_json(force=True, silent=True) or {}
    text = body.get("text", "")
    if not text:
        return jsonify({"error": "text field is required"}), 400
    return jsonify({"skills": extract_skills(text)})


@app.post("/match")
def match_endpoint():
    """
    Compute semantic similarity between a resume and a list of jobs.

    Request body:
    {
      "resume_text": "<resume text>",
      "jobs": [
        { "id": "...", "title": "...", "description": "...", "requiredSkills": [...] },
        ...
      ]
    }
    Response:
    {
      "matches": [
        { "id": "...", "semanticScore": 0.85, "skillScore": 0.75, "finalScore": 83 },
        ...
      ]
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    resume_text = body.get("resume_text", "")
    jobs = body.get("jobs", [])

    if not resume_text:
        return jsonify({"error": "resume_text is required"}), 400

    resume_skills = set(s.lower() for s in extract_skills(resume_text))
    resume_embedding = get_embedding(resume_text) if TRANSFORMERS_AVAILABLE else None

    matches = []
    for job in jobs:
        job_id = job.get("id", "")
        job_text = job.get("description", "") + " " + " ".join(job.get("requiredSkills", []))
        job_skills = set(s.lower() for s in (job.get("requiredSkills") or extract_skills(job_text)))

        # Skill overlap score
        if job_skills:
            matched = resume_skills & job_skills
            skill_score = len(matched) / len(job_skills)
        else:
            skill_score = 0.0

        # Semantic similarity score using sentence transformers
        if TRANSFORMERS_AVAILABLE and resume_embedding is not None:
            job_embedding = get_embedding(job_text)
            semantic_score = cosine_similarity_score(resume_embedding, job_embedding)
        else:
            semantic_score = skill_score  # Fallback to skill score

        # Weighted final score: 60% semantic + 40% skill overlap
        final_score = int(round((semantic_score * 0.6 + skill_score * 0.4) * 100))
        final_score = min(final_score, 100)

        matched_skills = sorted(resume_skills & job_skills)
        missing_skills = sorted(job_skills - resume_skills)

        matches.append({
            "id": job_id,
            "semanticScore": round(semantic_score, 4),
            "skillScore": round(skill_score, 4),
            "finalScore": final_score,
            "matchedSkills": [s.title() for s in matched_skills],
            "missingSkills": [s.title() for s in missing_skills],
        })

    # Sort by final score descending
    matches.sort(key=lambda x: x["finalScore"], reverse=True)
    return jsonify({"matches": matches})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
