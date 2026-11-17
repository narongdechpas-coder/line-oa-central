import { describe, expect, it } from 'vitest';
import { SEED } from '../data/seed';
import type { DemoUser } from '../types/domain';
import { SCORE_WEIGHTS, recommendPics, scoreCandidate } from '../utils/scoring';

const user = (over: Partial<DemoUser>): DemoUser => ({
  id: 'u',
  name: 'U',
  role: 'PIC_AGENT',
  departmentId: 'dep-claims',
  teamId: 'team-claims',
  skills: [],
  availability: 'AVAILABLE',
  workload: 0,
  experienceYears: 0,
  ...over,
});

describe('PIC scoring', () => {
  it('weights sum to 100%', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('perfect candidate scores 100', () => {
    const r = scoreCandidate(['claims', 'motor'], user({ skills: ['claims', 'motor'], workload: 0, experienceYears: 10 }));
    expect(r.total).toBe(100);
    expect(r.factors).toEqual({ skill: 100, workload: 100, availability: 100, experience: 100 });
  });

  it('applies Skill 35 / Workload 30 / Availability 20 / Experience 15', () => {
    // skill 50, workload 40, availability BUSY=50, experience 5y=50
    const r = scoreCandidate(['claims', 'motor'], user({ skills: ['claims'], workload: 60, availability: 'BUSY', experienceYears: 5 }));
    expect(r.total).toBe(Math.round(50 * 0.35 + 40 * 0.3 + 50 * 0.2 + 50 * 0.15)); // 47
    expect(r.matchedSkills).toEqual(['claims']);
  });

  it('caps experience at 10 years', () => {
    expect(scoreCandidate([], user({ experienceYears: 25 })).factors.experience).toBe(100);
  });

  it('ranks only eligible users in the case department; top is recommended', () => {
    const ranked = recommendPics({ requiredSkills: ['claims', 'motor'], currentDepartmentId: 'dep-claims' }, SEED.users);
    expect(ranked.length).toBeGreaterThan(1);
    const ids = ranked.map((r) => r.userId);
    expect(ids).not.toContain('usr-manager'); // MANAGER is not a PIC candidate
    expect(ids).not.toContain('usr-pic-3'); // other department
    expect(ranked.filter((r) => r.recommended)).toHaveLength(1);
    expect(ranked[0]?.recommended).toBe(true);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1]!.total).toBeGreaterThanOrEqual(ranked[i]!.total);
    expect(ranked[0]?.userId).toBe('usr-pic-1'); // Pimchanok: full skill match, low workload
  });
});
