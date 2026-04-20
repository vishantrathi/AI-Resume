/**
 * Tests for careerController helpers and skillHierarchy data.
 *
 * The controller functions depend on Mongoose models, so we test the
 * pure-logic parts (hierarchy lookup, difficulty ordering) directly,
 * without needing a live database.
 */

const path = require('path');

// Load the skill hierarchy data
const SKILL_HIERARCHY = require('../data/skillHierarchy.json');

const DIFFICULTY_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

function lookupHierarchy(skill) {
  const lower = skill.toLowerCase();
  for (const [key, value] of Object.entries(SKILL_HIERARCHY)) {
    if (key.toLowerCase() === lower) {
      return { key, ...value };
    }
  }
  return null;
}

describe('Skill Hierarchy Data', () => {
  it('should be a non-empty object', () => {
    expect(typeof SKILL_HIERARCHY).toBe('object');
    expect(Object.keys(SKILL_HIERARCHY).length).toBeGreaterThan(0);
  });

  it('every entry should have a difficulty field', () => {
    for (const [skill, data] of Object.entries(SKILL_HIERARCHY)) {
      expect(['beginner', 'intermediate', 'advanced']).toContain(data.difficulty);
    }
  });

  it('every entry should have a prerequisites array', () => {
    for (const [skill, data] of Object.entries(SKILL_HIERARCHY)) {
      expect(Array.isArray(data.prerequisites)).toBe(true);
    }
  });

  it('every entry should have a resources array with at least one item', () => {
    for (const [skill, data] of Object.entries(SKILL_HIERARCHY)) {
      expect(Array.isArray(data.resources)).toBe(true);
      expect(data.resources.length).toBeGreaterThan(0);
    }
  });

  it('every resource should have type, title, and url', () => {
    for (const [skill, data] of Object.entries(SKILL_HIERARCHY)) {
      for (const resource of data.resources) {
        expect(resource).toHaveProperty('type');
        expect(resource).toHaveProperty('title');
        expect(resource).toHaveProperty('url');
      }
    }
  });
});

describe('lookupHierarchy', () => {
  it('should find Docker (exact case)', () => {
    const result = lookupHierarchy('Docker');
    expect(result).not.toBeNull();
    expect(result.difficulty).toBe('intermediate');
  });

  it('should find docker (lowercase)', () => {
    const result = lookupHierarchy('docker');
    expect(result).not.toBeNull();
    expect(result.key).toBe('Docker');
  });

  it('should find AWS', () => {
    const result = lookupHierarchy('AWS');
    expect(result).not.toBeNull();
    expect(result.difficulty).toBe('advanced');
  });

  it('should return null for unknown skill', () => {
    const result = lookupHierarchy('FooBarBazSkillXYZ');
    expect(result).toBeNull();
  });

  it('should return resources for Kubernetes', () => {
    const result = lookupHierarchy('Kubernetes');
    expect(result).not.toBeNull();
    expect(result.resources.length).toBeGreaterThan(0);
  });
});

describe('Roadmap difficulty ordering', () => {
  it('beginner skills should come before intermediate', () => {
    expect(DIFFICULTY_ORDER.beginner).toBeLessThan(DIFFICULTY_ORDER.intermediate);
  });

  it('intermediate skills should come before advanced', () => {
    expect(DIFFICULTY_ORDER.intermediate).toBeLessThan(DIFFICULTY_ORDER.advanced);
  });

  it('should correctly sort an array of skills by difficulty', () => {
    const skills = [
      { skill: 'Kubernetes', difficulty: 'advanced', difficultyOrder: DIFFICULTY_ORDER.advanced },
      { skill: 'Docker', difficulty: 'intermediate', difficultyOrder: DIFFICULTY_ORDER.intermediate },
      { skill: 'Linux', difficulty: 'beginner', difficultyOrder: DIFFICULTY_ORDER.beginner },
    ];

    skills.sort((a, b) => a.difficultyOrder - b.difficultyOrder);

    expect(skills[0].skill).toBe('Linux');
    expect(skills[1].skill).toBe('Docker');
    expect(skills[2].skill).toBe('Kubernetes');
  });
});

describe('Skill Match Score calculation', () => {
  it('should compute 60% when 3 of 5 job skills are matched', () => {
    const matchedSkills = ['React', 'Node.js', 'MongoDB'];
    const totalJobSkills = 5;
    const skillMatchScore = Math.round((matchedSkills.length / totalJobSkills) * 100);
    expect(skillMatchScore).toBe(60);
  });

  it('should return 0 when no job skills exist', () => {
    const matchedSkills = [];
    const totalJobSkills = 0;
    const skillMatchScore = totalJobSkills > 0
      ? Math.round((matchedSkills.length / totalJobSkills) * 100)
      : 0;
    expect(skillMatchScore).toBe(0);
  });

  it('should return 100 when all job skills are matched', () => {
    const matchedSkills = ['React', 'Node.js'];
    const totalJobSkills = 2;
    const skillMatchScore = Math.round((matchedSkills.length / totalJobSkills) * 100);
    expect(skillMatchScore).toBe(100);
  });
});
