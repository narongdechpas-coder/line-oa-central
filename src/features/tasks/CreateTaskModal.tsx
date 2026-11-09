import { useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { isEscalationActive } from '../../utils/transitions';
import { addHours, fromBangkokInput, toBangkokInput } from '../../utils/time';
import { Modal } from '../../components/overlays/Modal';
import { Button, Field } from '../../components/common/ui';

export function CreateTaskModal({ caseId, escalationId, onClose, onDone }: { caseId: string; escalationId?: string; onClose: () => void; onDone: () => void }) {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const createTask = useDemoStore((s) => s.createTask);
  const L = useLookups();
  const c = data.cases.find((x) => x.id === caseId)!;
  const activeEsc = data.escalations.find((e) => e.caseId === caseId && isEscalationActive(e.status));
  const presetEsc = escalationId ? data.escalations.find((e) => e.id === escalationId) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [esc, setEsc] = useState(presetEsc?.id ?? '');
  const [dep, setDep] = useState(presetEsc?.toDepartmentId ?? c.currentDepartmentId);
  const [team, setTeam] = useState(presetEsc?.toTeamId ?? '');
  const [user, setUser] = useState('');
  const [due, setDue] = useState(toBangkokInput(addHours(now, 24)));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const teams = data.teams.filter((t) => t.departmentId === dep);
  const users = data.users.filter((u) => u.departmentId === dep && u.role !== 'DEPARTMENT_ADMIN');
  const escOptions = data.escalations.filter((e) => e.caseId === caseId && (e.status === 'ACCEPTED' || e.status === 'IN_PROGRESS'));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'กรุณาระบุชื่องาน';
    if (!dep) e.dep = 'กรุณาเลือกแผนก';
    if (!due) e.due = 'กรุณาระบุกำหนดเสร็จ';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = createTask(caseId, { title, description, assignedDepartmentId: dep, assignedTeamId: team || null, assignedUserId: user || null, dueAt: fromBangkokInput(due), escalationId: esc || null });
    if (report(r, `สร้างงานภายในแล้ว → ${L.depName(dep)}`)) onDone();
  };

  return (
    <Modal title={`สร้างงานภายใน (${c.caseNumber})`} onClose={onClose} width={600} footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" onClick={submit}>สร้างงาน</Button></>}>
      <p className="muted small">งานภายในและความคิดเห็นเห็นเฉพาะทีมงาน ไม่แสดงในแชทลูกค้า</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="ชื่องาน" htmlFor="tk-title" required error={errors.title}>
          <input id="tk-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field label="รายละเอียด" htmlFor="tk-desc">
          <textarea id="tk-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {(escOptions.length > 0 || activeEsc) && (
          <Field label="ผูกกับ Escalation" htmlFor="tk-esc" hint={escOptions.length ? undefined : 'Escalation ต้องถูกรับเรื่องก่อนจึงผูกงานได้'}>
            <select
              id="tk-esc"
              value={esc}
              onChange={(e) => {
                setEsc(e.target.value);
                const x = data.escalations.find((y) => y.id === e.target.value);
                if (x) { setDep(x.toDepartmentId); setTeam(x.toTeamId ?? ''); setUser(''); }
              }}
            >
              <option value="">— ไม่ผูก —</option>
              {escOptions.map((x) => <option key={x.id} value={x.id}>{L.depName(x.fromDepartmentId)} → {L.depName(x.toDepartmentId)}</option>)}
            </select>
          </Field>
        )}
        <div className="grid-2">
          <Field label="แผนกที่รับงาน" htmlFor="tk-dep" required error={errors.dep}>
            <select id="tk-dep" value={dep} onChange={(e) => { setDep(e.target.value); setTeam(''); setUser(''); }}>
              {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="ทีม" htmlFor="tk-team">
            <select id="tk-team" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">— ทีมหลักของแผนก —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="ผู้รับงาน" htmlFor="tk-user">
            <select id="tk-user" value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="">— ยังไม่ระบุ —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="กำหนดเสร็จ (เวลาไทย)" htmlFor="tk-due" required error={errors.due}>
            <input id="tk-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
