import { describe, expect, it } from 'vitest';
import { computeSla, resumeDueAt } from '../utils/sla';

const now = '2026-11-09T10:00:00+07:00';
const base = { status: 'IN_PROGRESS' as const, slaPausedAt: null, resolvedAt: null };

describe('SLA (simulated)', () => {
  it('ON_TRACK / AT_RISK / BREACHED by remaining time', () => {
    expect(computeSla({ ...base, dueAt: '2026-11-09T15:00:00+07:00' }, now).state).toBe('ON_TRACK');
    expect(computeSla({ ...base, dueAt: '2026-11-09T12:00:00+07:00' }, now).state).toBe('AT_RISK');
    expect(computeSla({ ...base, dueAt: '2026-11-09T09:59:00+07:00' }, now).state).toBe('BREACHED');
  });
  it('PAUSED while slaPausedAt is set', () => {
    expect(computeSla({ ...base, status: 'PENDING', dueAt: '2026-11-08T10:00:00+07:00', slaPausedAt: '2026-11-08T08:00:00+07:00' }, now).state).toBe('PAUSED');
  });
  it('finished cases are judged at resolution time', () => {
    const r = computeSla({ status: 'CLOSED', dueAt: '2026-11-09T09:00:00+07:00', slaPausedAt: null, resolvedAt: '2026-11-09T08:00:00+07:00' }, now);
    expect(r).toMatchObject({ state: 'ON_TRACK', final: true });
  });
  it('resume pushes due time by the paused duration', () => {
    expect(resumeDueAt('2026-11-09T12:00:00Z', '2026-11-09T08:00:00Z', '2026-11-09T10:00:00Z')).toBe('2026-11-09T14:00:00.000Z');
  });
});
