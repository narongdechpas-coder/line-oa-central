import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { getConversation } from '../../services/mock/queries';
import { CATEGORY_NAMES } from '../../utils/categories';
import { PRIORITY_LABEL } from '../../utils/labels';
import { SLA_HOURS } from '../../utils/sla';
import { PRIORITIES, type Priority } from '../../types/domain';
import { Modal } from '../../components/overlays/Modal';
import { Button, Field } from '../../components/common/ui';
import { ChannelBadge } from '../channels/ChannelBadge';

export function CreateCaseModal({ conversationId, onClose, onCreated }: { conversationId: string; onClose: () => void; onCreated: (caseId: string) => void }) {
  const data = useDemoStore((s) => s.data);
  const createCase = useDemoStore((s) => s.createCase);
  const L = useLookups();
  const conv = getConversation(data, conversationId)!;
  const firstInbound = conv.messages.find((m) => m.direction === 'INBOUND');
  const [title, setTitle] = useState(firstInbound?.text.slice(0, 60) ?? '');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'กรุณาระบุหัวข้อ Case';
    if (!category) e.category = 'กรุณาเลือกประเภท Case';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = createCase(conversationId, { title, category, priority, description });
    if (report(r, `สร้าง Case แล้ว`)) onCreated(r.value);
  };

  return (
    <Modal
      title="สร้าง Case จากบทสนทนา"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={submit}>สร้าง Case</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="locked-box">
          <p className="locked-title"><Lock size={14} aria-hidden="true" /> ต้นทางของ Case (คัดลอกจากบทสนทนา แก้ไขไม่ได้)</p>
          <div className="locked-grid">
            <span>LINE OA ต้นทาง</span>
            <ChannelBadge channelId={conv.conversation.channelId} />
            <span>ลูกค้าต้นทาง</span>
            <strong>{conv.customer?.displayName} <span className="mono muted">({conv.customer?.lineUserId})</span></strong>
            <span>แผนกที่รับ Case</span>
            <span>{L.depName(conv.channel?.departmentId)}</span>
          </div>
        </div>
        <Field label="หัวข้อ Case" htmlFor="cc-title" required error={errors.title}>
          <input id="cc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <div className="grid-2">
          <Field label="ประเภท" htmlFor="cc-cat" required error={errors.category} hint="ใช้จับคู่ทักษะตอนแนะนำ PIC">
            <select id="cc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— เลือก —</option>
              {CATEGORY_NAMES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="ความสำคัญ" htmlFor="cc-pri" hint={`SLA จำลอง ${SLA_HOURS[priority]} ชั่วโมง`}>
            <select id="cc-pri" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]} ({p})</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="รายละเอียด" htmlFor="cc-desc">
          <textarea id="cc-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
