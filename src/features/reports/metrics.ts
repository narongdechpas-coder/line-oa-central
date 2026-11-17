// Aggregations for Dashboard and Reports. Live from demo state, scoped to the acting role.
import type { Case, DemoData, DemoUser } from '../../types/domain';
import { canSeeCase, canSeeConversation } from '../../utils/permissions';
import { computeSla } from '../../utils/sla';
import { isCaseOpen } from '../../utils/transitions';
import { ms, toBangkokInput } from '../../utils/time';

export type RangeKey = '1' | '7' | '30';
export const RANGE_LABEL: Record<RangeKey, string> = { '1': 'วันนี้', '7': '7 วันล่าสุด', '30': '30 วันล่าสุด' };

export const dayKey = (iso: string) => toBangkokInput(iso).slice(0, 10);

/** Start of the range at Bangkok midnight, `days` days back including today. */
export function rangeStart(now: string, days: number): number {
  const today = dayKey(now);
  return Date.parse(`${today}T00:00:00+07:00`) - (days - 1) * 86_400_000;
}

export function scoped(data: DemoData, me: DemoUser) {
  const cases = data.cases.filter((c) => canSeeCase(data, me, c));
  const caseIds = new Set(cases.map((c) => c.id));
  return {
    cases,
    conversations: data.conversations.filter((c) => canSeeConversation(data, me, c)),
    escalations: data.escalations.filter((e) => caseIds.has(e.caseId)),
    tasks: data.tasks.filter((t) => caseIds.has(t.caseId)),
    timeline: data.timeline.filter((t) => caseIds.has(t.caseId)),
  };
}

export function casesPerDay(cases: Case[], now: string, days: number) {
  const start = rangeStart(now, days);
  const out: { day: string; label: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * 86_400_000 + 7 * 3600_000).toISOString().slice(0, 10);
    out.push({ day: d, label: `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`, count: 0 });
  }
  for (const c of cases) {
    const row = out.find((r) => r.day === dayKey(c.createdAt));
    if (row && ms(c.createdAt) <= ms(now)) row.count += 1;
  }
  return out;
}

export function slaCounts(cases: Case[], now: string) {
  const open = { ON_TRACK: 0, AT_RISK: 0, BREACHED: 0, PAUSED: 0 };
  const finished = { met: 0, breached: 0 };
  for (const c of cases) {
    const s = computeSla(c, now);
    if (isCaseOpen(c.status)) open[s.state] += 1;
    else if (s.final) s.state === 'BREACHED' ? (finished.breached += 1) : (finished.met += 1);
  }
  return { open, finished };
}
