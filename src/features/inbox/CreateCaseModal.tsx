import { useMemo, useState } from 'react';
import { ArrowRight, Eye, Lock, Star } from 'lucide-react';
import { useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { getConversation } from '../../services/mock/queries';
import { rankPicsForCase } from '../../utils/routing';
import { AVAILABILITY_LABEL, PRIORITY_LABEL } from '../../utils/labels';
import { SLA_HOURS } from '../../utils/sla';
import { PRIORITIES, type Priority } from '../../types/domain';
import { Modal } from '../../components/overlays/Modal';
import { Avatar, Button, Field } from '../../components/common/ui';
import { Chip } from '../../components/common/Chip';
import { ChannelBadge } from '../channels/ChannelBadge';

/**
 * Create Case = choose a topic. The topic decides the responsible department and its PIC list.
 * A topic owned by another department creates the case here and escalates it automatically.
 */
export function CreateCaseModal({ conversationId, onClose, onCreated }: { conversationId: string; onClose: () => void; onCreated: (caseId: string) => void }) {
  const data = useDemoStore((s) => s.data);
  const createCase = useDemoStore((s) => s.createCase);
  const L = useLookups();
  const conv = getConversation(data, conversationId)!;
  const originDep = conv.channel?.departmentId ?? '';
  const firstInbound = conv.messages.find((m) => m.direction === 'INBOUND');
  const [title, setTitle] = useState(firstInbound?.text.slice(0, 60) ?? '');
  const [topicId, setTopicId] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [description, setDescription] = useState('');
  const [pic, setPic] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topics = data.topics.filter((t) => t.active);
  const own = topics.filter((t) => t.responsibleDepartmentId === originDep);
  const other = topics.filter((t) => t.responsibleDepartmentId !== originDep);
  const topic = topics.find((t) => t.id === topicId);
  const crossDept = !!topic && topic.responsibleDepartmentId !== originDep;
  const ranking = useMemo(
    () =>
      topic
        ? rankPicsForCase(data, { requiredSkills: topic.skills, currentDepartmentId: topic.responsibleDepartmentId, topicId: topic.id, originalCustomerId: conv.conversation.customerId })
        : null,
    [data, topic, conv.conversation.customerId],
  );

  const chooseTopic = (id: string) => {
    setTopicId(id);
    setErrors((e) => ({ ...e, topic: '' }));
    const t = topics.find((x) => x.id === id);
    if (!t) return setPic('');
    const rk = rankPicsForCase(data, { requiredSkills: t.skills, currentDepartmentId: t.responsibleDepartmentId, topicId: t.id, originalCustomerId: conv.conversation.customerId });
    setPic(rk.ranked[0]?.userId ?? ''); // preselect priority 1 (customer owner if on the list, else top score)
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'กรุณาระบุหัวข้อ Case';
    if (!topic) e.topic = 'กรุณาเลือกหัวข้อเรื่อง';
    if (crossDept && !reason.trim()) e.reason = 'กรุณาระบุเหตุผลการส่งต่อ';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = createCase(conversationId, { title, topicId, priority, description, picUserId: pic || null, ...(crossDept ? { escalationReason: reason } : {}) });
    if (report(r, crossDept ? `สร้าง Case และส่งต่อไป ${L.depName(topic!.responsibleDepartmentId)} แล้ว — รอแผนกปลายทางรับเรื่อง` : 'สร้าง Case แล้ว')) onCreated(r.value);
  };

  return (
    <Modal
      title="สร้าง Case จากบทสนทนา"
      onClose={onClose}
      width={760}
      footer={
        <>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={submit}>{crossDept ? 'สร้าง Case และส่งต่อ' : 'สร้าง Case'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="locked-box">
          <p className="locked-title"><Lock size={14} aria-hidden="true" /> ต้นทางของ Case (คัดลอกจากบทสนทนา แก้ไขไม่ได้)</p>
          <div className="locked-grid">
            <span>LINE OA ต้นทาง</span>
            <ChannelBadge channelId={conv.conversation.channelId} />
            <span>ลูกค้าต้นทาง</span>
            <strong>{conv.customer?.displayName} <span className="mono muted">({conv.customer?.lineUserId})</span></strong>
            <span>ผู้ดูแลหลักของลูกค้า</span>
            <span>{conv.customer?.ownerUserId ? `${L.userName(conv.customer.ownerUserId)} · ${L.depName(L.user(conv.customer.ownerUserId)?.departmentId)}` : <span className="muted">ยังไม่มี (เช่น ผู้มุ่งหวังที่สอบถามข้อมูล)</span>}</span>
          </div>
        </div>
        <Field label="ชื่อเรื่อง" htmlFor="cc-title" required error={errors.title}>
          <input id="cc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <div className="grid-2">
          <Field label="หัวข้อเรื่อง (กำหนดแผนกและ PIC)" htmlFor="cc-topic" required error={errors.topic}>
            <select id="cc-topic" value={topicId} onChange={(e) => chooseTopic(e.target.value)}>
              <option value="">— เลือกหัวข้อ —</option>
              <optgroup label={`แผนก ${L.depName(originDep)} (รับเรื่องเอง)`}>
                {own.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
              <optgroup label="ส่งต่อแผนกอื่น">
                {other.map((t) => <option key={t.id} value={t.id}>{t.name} → {L.depName(t.responsibleDepartmentId)}</option>)}
              </optgroup>
            </select>
          </Field>
          <Field label="ความสำคัญ" htmlFor="cc-pri" hint={`SLA จำลอง ${SLA_HOURS[priority]} ชั่วโมง`}>
            <select id="cc-pri" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]} ({p})</option>)}
            </select>
          </Field>
        </div>

        {topic && ranking && (
          <section className="route-box" aria-label="การรับเรื่องตามหัวข้อ">
            <div className="route-head">
              <span>รับเรื่องโดย</span> <strong>{L.depName(topic.responsibleDepartmentId)}</strong>
              {topic.observerDepartmentIds.length > 0 && (
                <span className="muted small inline"><Eye size={12} aria-hidden="true" /> เห็น log: {topic.observerDepartmentIds.map((d) => L.depName(d)).join(', ')}</span>
              )}
            </div>
            {crossDept && (
              <div className="banner warn small">
                <ArrowRight size={14} aria-hidden="true" className="banner-icon" />
                <span className="banner-text">
                  หัวข้อนี้เป็นของ {L.depName(topic.responsibleDepartmentId)} — ระบบจะสร้าง Case ที่ {L.depName(originDep)} แล้วส่ง Escalation ไปให้อัตโนมัติ PIC ที่เลือกจะเป็นผู้รับผิดชอบที่ขอ (แผนกปลายทางกดรับก่อน) ลูกค้ายังคุยผ่าน {conv.channel?.name} เหมือนเดิม
                </span>
              </div>
            )}

            {ranking.ownerOutsideList && (
              <div className="pic-group">
                <p className="pic-group-title">ผู้ดูแลหลักของลูกค้า · {L.depName(L.user(ranking.ownerOutsideList)?.departmentId)}</p>
                <div className="cand compact is-current">
                  <Avatar name={L.userName(ranking.ownerOutsideList)} size={32} userId={ranking.ownerOutsideList} />
                  <div className="cand-who">
                    <strong>{L.userName(ranking.ownerOutsideList)}</strong> <Chip tone="purple">ผู้ดูแลหลัก</Chip>
                    <div className="muted small">ไม่อยู่ในรายชื่อ PIC ของหัวข้อนี้ → จะติดตาม Case ในฐานะผู้ติดตาม (OBSERVER) ไม่ได้รับงาน</div>
                  </div>
                </div>
              </div>
            )}

            <fieldset className="pic-group">
              <legend className="pic-group-title">{L.depName(topic.responsibleDepartmentId)} · PIC ของหัวข้อ {topic.name}</legend>
              {ranking.ranked.map((r) => {
                const u = L.user(r.userId)!;
                return (
                  <label key={r.userId} className={`cand compact ${pic === r.userId ? 'selected' : ''}`}>
                    <input type="radio" name="cc-pic" value={r.userId} checked={pic === r.userId} onChange={() => setPic(r.userId)} />
                    <Avatar name={u.name} size={32} userId={u.id} />
                    <div className="cand-who">
                      <strong className={r.isCustomerOwner ? 'owner-name' : undefined}>{u.name}</strong>{' '}
                      {r.isCustomerOwner && <Chip tone="purple">ผู้ดูแลหลักของลูกค้า · ลำดับแรก</Chip>}{' '}
                      {r.recommended && !r.isCustomerOwner && <Chip tone="blue"><Star size={11} aria-hidden="true" /> แนะนำ</Chip>}
                      <div className="muted small">{AVAILABILITY_LABEL[u.availability]} · ภาระงาน {u.workload}% · {u.experienceYears} ปี</div>
                    </div>
                    <div className="cand-total"><span className="score sm">{r.total}</span><span className="muted small">/100</span></div>
                  </label>
                );
              })}
              <label className={`cand compact ${pic === '' ? 'selected' : ''}`}>
                <input type="radio" name="cc-pic" value="" checked={pic === ''} onChange={() => setPic('')} />
                <span className="muted">ยังไม่ระบุ — ให้ {crossDept ? 'แผนกปลายทาง' : 'Supervisor'} มอบหมายภายหลัง</span>
              </label>
            </fieldset>
            <p className="muted small">รายชื่อ PIC ตั้งค่าโดย Admin ในหน้า “แผนกและหัวข้อ” · คะแนนใช้สูตรเดิม (ทักษะ 35 / ภาระงาน 30 / ความพร้อม 20 / ประสบการณ์ 15) และผู้ดูแลหลักของลูกค้าขึ้นก่อนเมื่ออยู่ในรายชื่อ</p>
          </section>
        )}

        {crossDept && (
          <Field label="เหตุผลการส่งต่อ" htmlFor="cc-reason" required error={errors.reason}>
            <textarea id="cc-reason" rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: '' })); }} maxLength={500} />
          </Field>
        )}
        <Field label="รายละเอียด" htmlFor="cc-desc">
          <textarea id="cc-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
