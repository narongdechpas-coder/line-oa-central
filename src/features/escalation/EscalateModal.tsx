import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { Modal } from '../../components/overlays/Modal';
import { Button, Field } from '../../components/common/ui';
import { ChannelBadge } from '../channels/ChannelBadge';

export function EscalateModal({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => void }) {
  const data = useDemoStore((s) => s.data);
  const createEscalation = useDemoStore((s) => s.createEscalation);
  const L = useLookups();
  const c = data.cases.find((x) => x.id === caseId)!;
  const [dep, setDep] = useState('');
  const [team, setTeam] = useState('');
  const [owner, setOwner] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const targets = data.departments.filter((d) => d.id !== c.currentDepartmentId);
  const teams = data.teams.filter((t) => t.departmentId === dep);
  const owners = data.users.filter((u) => u.departmentId === dep && (u.role === 'PIC_AGENT' || u.role === 'SUPERVISOR' || u.role === 'MANAGER'));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!dep) e.dep = 'กรุณาเลือกแผนกปลายทาง';
    if (!reason.trim()) e.reason = 'กรุณาระบุเหตุผลการส่งต่อ';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = createEscalation(caseId, { toDepartmentId: dep, toTeamId: team || null, reason, requestedOwnerId: owner || null });
    if (report(r, `ส่งต่อภายในไปยัง ${L.depName(dep)} แล้ว — รอแผนกปลายทางพิจารณา`)) onDone();
  };

  return (
    <Modal
      title={`Escalate Case (${c.caseNumber})`}
      onClose={onClose}
      width={600}
      footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" onClick={submit}>ส่งต่อ (Escalate)</Button></>}
    >
      <div className="banner info">
        <Lock size={14} aria-hidden="true" />
        <span>Internal handoff only — customer remains on original LINE OA <ChannelBadge channelId={c.originalChannelId} small /></span>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid-2">
          <Field label="จากแผนก / ทีม" htmlFor="esc-from">
            <input id="esc-from" value={`${L.depName(c.currentDepartmentId)} / ${L.teamName(c.currentTeamId)}`} readOnly />
          </Field>
          <span />
          <Field label="ส่งไปยังแผนก" htmlFor="esc-dep" required error={errors.dep}>
            <select id="esc-dep" value={dep} onChange={(e) => { setDep(e.target.value); setTeam(''); setOwner(''); }}>
              <option value="">— เลือก —</option>
              {targets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="ทีมเป้าหมาย (ไม่บังคับ)" htmlFor="esc-team">
            <select id="esc-team" value={team} onChange={(e) => setTeam(e.target.value)} disabled={!dep}>
              <option value="">— ทีมหลักของแผนก —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="ผู้รับผิดชอบที่ขอ (ไม่บังคับ)" htmlFor="esc-owner" hint="ถ้าระบุ เมื่อแผนกปลายทางรับเรื่อง ผู้นี้จะเป็น PIC ระหว่าง Escalation">
          <select id="esc-owner" value={owner} onChange={(e) => setOwner(e.target.value)} disabled={!dep}>
            <option value="">— ให้แผนกปลายทางตัดสินใจ —</option>
            {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="เหตุผล / รายละเอียด" htmlFor="esc-reason" required error={errors.reason}>
          <textarea id="esc-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </form>
    </Modal>
  );
}
