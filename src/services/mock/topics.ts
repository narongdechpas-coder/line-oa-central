// Admin setup: department → topics → PIC list. Pure functions over DemoState.
import type { DemoState, Topic } from '../../types/domain';
import { canManageTopic } from '../../utils/permissions';
import { isEligiblePic } from '../../utils/scoring';
import { DemoError, actor, audit, begin, deny, nextId } from './operations';

export type TopicInput = Omit<Topic, 'id' | 'active'> & { id?: string };

export function saveTopic(state: DemoState, input: TopicInput): { state: DemoState; topicId: string } {
  const d = begin(state);
  const me = actor(d);
  const existing = input.id ? d.data.topics.find((t) => t.id === input.id) : undefined;
  if (input.id && !existing) throw new DemoError('ไม่พบหัวข้อ', 'NOT_FOUND');
  if (!canManageTopic(me, input) || (existing && !canManageTopic(me, existing))) deny('Dept Admin จัดการได้เฉพาะหัวข้อที่แผนกตัวเองเป็นผู้รับเรื่อง');
  const name = input.name.trim();
  if (!name) throw new DemoError('กรุณาตั้งชื่อหัวข้อ');
  if (d.data.topics.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== input.id)) throw new DemoError(`มีหัวข้อ “${name}” อยู่แล้ว`);
  if (!d.data.departments.some((x) => x.id === input.responsibleDepartmentId)) throw new DemoError('กรุณาเลือกแผนกที่รับเรื่อง');
  const observers = [...new Set(input.observerDepartmentIds)].filter((x) => x !== input.responsibleDepartmentId);
  if (observers.some((x) => !d.data.departments.some((dep) => dep.id === x))) throw new DemoError('แผนกที่ดู log ไม่ถูกต้อง');
  const pics = [...new Set(input.picUserIds)];
  for (const id of pics) {
    const u = d.data.users.find((x) => x.id === id);
    if (!u || !isEligiblePic(u) || u.departmentId !== input.responsibleDepartmentId) throw new DemoError('PIC ของหัวข้อต้องเป็น PIC / Supervisor ในแผนกที่รับเรื่อง');
  }
  if (!pics.length) throw new DemoError('ต้องมี PIC อย่างน้อย 1 คน');
  const skills = [...new Set(input.skills.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const fields = { name, ...(input.description?.trim() ? { description: input.description.trim() } : {}), skills, responsibleDepartmentId: input.responsibleDepartmentId, observerDepartmentIds: observers, picUserIds: pics };
  if (existing) {
    // Existing cases keep their department; the new setup applies to new cases and future assignments.
    Object.assign(existing, fields);
    if (!input.description?.trim()) delete existing.description;
    audit(d, 'topic.update', 'TOPIC', existing.id);
    return { state: d, topicId: existing.id };
  }
  const t: Topic = { id: nextId(d, 'tp'), ...fields, active: true };
  d.data.topics.push(t);
  audit(d, 'topic.create', 'TOPIC', t.id);
  return { state: d, topicId: t.id };
}

/** Deactivated topics disappear from Create Case; existing cases keep their topic. */
export function setTopicActive(state: DemoState, topicId: string, active: boolean): DemoState {
  const d = begin(state);
  const me = actor(d);
  const t = d.data.topics.find((x) => x.id === topicId);
  if (!t) throw new DemoError('ไม่พบหัวข้อ', 'NOT_FOUND');
  if (!canManageTopic(me, t)) deny();
  if (t.active === active) return state;
  t.active = active;
  audit(d, active ? 'topic.activate' : 'topic.deactivate', 'TOPIC', t.id);
  return d;
}
