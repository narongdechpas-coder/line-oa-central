// PIC recommendation — ILLUSTRATIVE DEMO LOGIC, not a validated production model.
// Weights from docs/handover/02_workflows/02_WORKFLOW_SPEC.md §B.
import type { Availability, Case, DemoUser } from '../types/domain';

export const SCORE_WEIGHTS = {
  skill: 0.35,
  workload: 0.3,
  availability: 0.2,
  experience: 0.15,
} as const;

export const AVAILABILITY_SCORE: Record<Availability, number> = {
  AVAILABLE: 100,
  BUSY: 50,
  AWAY: 20,
  OFFLINE: 0,
};

/** Years of experience at which the experience factor maxes out. */
export const EXPERIENCE_CAP_YEARS = 10;

export interface ScoreBreakdown {
  skill: number;
  workload: number;
  availability: number;
  experience: number;
}

export interface PicRecommendation {
  userId: string;
  /** 0–100, rounded to an integer. */
  total: number;
  /** Factor scores 0–100 before weighting. */
  factors: ScoreBreakdown;
  matchedSkills: string[];
  recommended: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function scoreCandidate(requiredSkills: string[], user: DemoUser): Omit<PicRecommendation, 'recommended'> {
  const matchedSkills = requiredSkills.filter((s) => user.skills.includes(s));
  const factors: ScoreBreakdown = {
    skill: requiredSkills.length ? (matchedSkills.length / requiredSkills.length) * 100 : 100,
    workload: clamp(100 - user.workload),
    availability: AVAILABILITY_SCORE[user.availability],
    experience: clamp((user.experienceYears / EXPERIENCE_CAP_YEARS) * 100),
  };
  const total =
    factors.skill * SCORE_WEIGHTS.skill +
    factors.workload * SCORE_WEIGHTS.workload +
    factors.availability * SCORE_WEIGHTS.availability +
    factors.experience * SCORE_WEIGHTS.experience;
  return { userId: user.id, total: Math.round(total), factors, matchedSkills };
}

/** Who can hold a case as PRIMARY_PIC in the demo. */
export const isEligiblePic = (u: DemoUser): boolean =>
  (u.role === 'PIC_AGENT' || u.role === 'SUPERVISOR') && u.availability !== 'OFFLINE';

/**
 * Rank eligible candidates in the case's current department. Moving work to another
 * department goes through Escalation, never through PIC assignment.
 * Ties break by lower workload, then name, so the ranking is deterministic.
 */
export function recommendPics(
  c: Pick<Case, 'requiredSkills' | 'currentDepartmentId'>,
  users: DemoUser[],
): PicRecommendation[] {
  const pool = users.filter((u) => isEligiblePic(u) && u.departmentId === c.currentDepartmentId);
  const ranked = pool
    .map((u) => ({ ...scoreCandidate(c.requiredSkills, u), _u: u }))
    .sort((a, b) => b.total - a.total || a._u.workload - b._u.workload || a._u.name.localeCompare(b._u.name));
  return ranked.map(({ _u, ...r }, i) => ({ ...r, recommended: i === 0 }));
}
