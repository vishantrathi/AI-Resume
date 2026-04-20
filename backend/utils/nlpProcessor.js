/**
 * NLP Processor Utility
 *
 * Provides tokenization, stop-word removal, keyword extraction,
 * and skill identification from resume or job description text.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'i', 'we', 'you', 'he', 'she', 'it', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'our', 'your', 'his', 'its', 'their',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'as', 'if', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'about', 'against', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'up', 'down', 'out', 'off', 'while',
]);

// Curated skill keywords recognized by the system
const SKILL_KEYWORDS = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c', 'c++', 'c#', 'ruby',
  'go', 'golang', 'rust', 'swift', 'kotlin', 'php', 'scala', 'r', 'matlab',
  'perl', 'haskell', 'elixir', 'dart', 'bash', 'shell', 'powershell',
  // Frontend
  'react', 'reactjs', 'react.js', 'angular', 'angularjs', 'vue', 'vuejs',
  'html', 'html5', 'css', 'css3', 'sass', 'less', 'tailwind', 'bootstrap',
  'jquery', 'redux', 'webpack', 'vite', 'nextjs', 'next.js', 'gatsby',
  'svelte', 'ember', 'backbone',
  // Backend
  'node', 'nodejs', 'node.js', 'express', 'expressjs', 'express.js',
  'django', 'flask', 'fastapi', 'spring', 'springboot', 'spring boot',
  'rails', 'laravel', 'asp.net', 'nestjs', 'nest.js', 'koa', 'hapi',
  // Databases
  'mongodb', 'mysql', 'postgresql', 'postgres', 'sqlite', 'redis',
  'elasticsearch', 'cassandra', 'dynamodb', 'firebase', 'supabase',
  'oracle', 'mssql', 'sql server', 'mariadb', 'neo4j',
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
  'jenkins', 'ci/cd', 'terraform', 'ansible', 'nginx', 'apache',
  'linux', 'ubuntu', 'centos', 'git', 'github', 'gitlab', 'bitbucket',
  // APIs & Protocols
  'rest', 'restful', 'rest api', 'graphql', 'grpc', 'soap', 'websocket',
  'oauth', 'jwt', 'openapi', 'swagger',
  // AI / ML / Data
  'machine learning', 'deep learning', 'nlp', 'natural language processing',
  'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas',
  'numpy', 'matplotlib', 'seaborn', 'opencv', 'huggingface', 'transformers',
  'bert', 'gpt', 'llm', 'data science', 'data analysis', 'data engineering',
  'spark', 'hadoop', 'kafka', 'airflow', 'tableau', 'power bi',
  // Mobile
  'react native', 'flutter', 'android', 'ios', 'xcode', 'swift',
  // Testing
  'jest', 'mocha', 'chai', 'pytest', 'junit', 'selenium', 'cypress',
  'playwright', 'testing', 'unit testing', 'integration testing',
  // Architectures & patterns
  'microservices', 'serverless', 'mvc', 'agile', 'scrum', 'devops',
  'object oriented', 'oop', 'functional programming', 'tdd', 'bdd',
  // Other common skills
  'sql', 'nosql', 'api', 'xml', 'json', 'linux', 'blockchain',
  'solidity', 'web3', 'figma', 'photoshop', 'jira', 'confluence',
];

/**
 * Tokenize text into lowercase word tokens.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s#+]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Remove stop words from a token array.
 * @param {string[]} tokens
 * @returns {string[]}
 */
function removeStopWords(tokens) {
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

/**
 * Extract multi-word skill phrases from text.
 * @param {string} text
 * @returns {string[]}
 */
function extractMultiWordSkills(text) {
  const lower = text.toLowerCase();
  const found = [];
  // Check multi-word skills first (longer phrases take priority)
  const multiWord = SKILL_KEYWORDS.filter((s) => s.includes(' ') || s.includes('.'));
  for (const skill of multiWord) {
    if (lower.includes(skill)) {
      found.push(skill);
    }
  }
  return found;
}

/**
 * Extract skills from text using keyword matching against the curated list.
 * @param {string} text
 * @returns {string[]} Unique list of identified skills (normalised to title case)
 */
function extractSkills(text) {
  if (!text || typeof text !== 'string') return [];

  const multiWordSkills = extractMultiWordSkills(text);

  const tokens = removeStopWords(tokenize(text));
  const singleWordSkills = SKILL_KEYWORDS.filter(
    (skill) => !skill.includes(' ') && tokens.includes(skill)
  );

  const allSkills = [...new Set([...multiWordSkills, ...singleWordSkills])];

  // Return normalised (capitalised) skill names
  return allSkills.map((s) => {
    // Keep well-known acronyms/brands uppercase
    const upper = ['html', 'css', 'sql', 'api', 'json', 'xml', 'aws', 'gcp',
      'oop', 'tdd', 'bdd', 'mvc', 'jwt', 'rest', 'grpc', 'soap',
      'nlp', 'llm', 'bert', 'gpt', 'k8s', 'ci/cd'];
    if (upper.includes(s.toLowerCase())) return s.toUpperCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}

/**
 * Simple section-based extractor.
 * Splits resume text into rough sections using common headings.
 * @param {string} text
 * @returns {{ experience: string[], education: string[], certifications: string[], projects: string[] }}
 */
function extractSections(text) {
  if (!text) return { experience: [], education: [], certifications: [], projects: [] };

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const SECTION_PATTERNS = {
    experience: /^(work\s+)?experience|employment|work\s+history/i,
    education: /^education|academic|qualifications?/i,
    certifications: /^certifications?|certificates?|courses?|training/i,
    projects: /^projects?|portfolio/i,
  };

  const sections = { experience: [], education: [], certifications: [], projects: [] };
  let currentSection = null;

  for (const line of lines) {
    let matched = false;
    for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line)) {
        currentSection = section;
        matched = true;
        break;
      }
    }
    if (!matched && currentSection && line.length > 3) {
      sections[currentSection].push(line);
    }
  }

  // Limit to 10 entries per section to avoid noise
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].slice(0, 10);
  }

  return sections;
}

/**
 * Generate a short summary (first 3 non-trivial lines) from resume text.
 * @param {string} text
 * @returns {string}
 */
function generateSummary(text) {
  if (!text) return '';
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);
  return lines.slice(0, 3).join(' ').substring(0, 300);
}

/**
 * Full resume parsing pipeline.
 * @param {string} text  Raw text extracted from the resume file
 * @returns {object} Parsed resume data
 */
function parseResume(text) {
  const skills = extractSkills(text);
  const sections = extractSections(text);
  const summary = generateSummary(text);

  return {
    skills,
    experience: sections.experience,
    education: sections.education,
    certifications: sections.certifications,
    projects: sections.projects,
    summary,
    rawText: text,
  };
}

module.exports = { tokenize, removeStopWords, extractSkills, extractSections, parseResume, generateSummary };
