// Topic-based routing. A topic names ONE responsible department (with an ordered PIC list)
// and any number of observer departments that may read the case log.
import type { Case, DemoData, Topic } from '../types/domain';
import { recommendPics, type PicRecommendation } from './scoring';

export const topicOf = (data: DemoData, c: Pick<Case, 'topicId'>): Topic | undefined =>
  c.topicId ? data.topics.find((t) => t.id === c.topicId) : undefined;

export interface PicRanking {
  /** Ranked candidates; the customer's owner is moved to the top when they are in the list. */
  ranked: (PicRecommendation & { isCustomerOwner: boolean })[];
  /** Customer owner who is NOT a candidate for this topic/department (shown as observer only). */
  ownerOutsideList: string | null;
  /** True when the candidate pool comes from the topic's PIC list. */
  fromTopic: boolean;
}

/**
 * PIC candidates for a case (or a case being created).
 * - Topic PIC list applies while the case sits in the topic's responsible department;
 *   after an escalation elsewhere, every eligible PIC of the current department is a candidate.
 * - Scores keep the spec weights (35/30/20/15). The customer owner, if a candidate, is pinned first.
 */
export function rankPicsForCase(
  data: DemoData,
  c: Pick<Case, 'requiredSkills' | 'currentDepartmentId' | 'topicId' | 'originalCustomerId'>,
): PicRanking {
  const topic = topicOf(data, c);
  const fromTopic = !!topic && topic.active && topic.responsibleDepartmentId === c.currentDepartmentId && topic.picUserIds.length > 0;
  const scored = recommendPics(c, data.users, fromTopic ? topic!.picUserIds : undefined);
  const owner = data.customers.find((x) => x.id === c.originalCustomerId)?.ownerUserId ?? null;
  const ownerIdx = owner ? scored.findIndex((r) => r.userId === owner) : -1;
  const ordered = ownerIdx > 0 ? [scored[ownerIdx]!, ...scored.filter((_, i) => i !== ownerIdx)] : scored;
  return {
    ranked: ordered.map((r, i) => ({ ...r, recommended: i === 0, isCustomerOwner: r.userId === owner })),
    ownerOutsideList: owner && ownerIdx < 0 ? owner : null,
    fromTopic,
  };
}
