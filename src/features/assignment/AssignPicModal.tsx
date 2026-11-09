import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { SCORE_WEIGHTS, recommendPics } from '../../utils/scoring';
import { AVAILABILITY_LABEL } from '../../utils/labels';
import { Modal } from '../../components/overlays/Modal';
import { Avatar, Button, EmptyState, Field } from '../../components/common/ui';
import { Chip, DemoTag } from '../../components/common/Chip';

const FACTORS = [
  ['skill', 'ทักษะ', SCORE_WEIGHTS.skill],
  ['workload', 'ภาระงาน', SCORE_WEIGHTS.workload],
  ['availability', 'ความพร้อม', SCORE_WEIGHTS.availability],
  ['experience', 'ประสบการณ์', SCORE_WEIGHTS.experience],
] as const;

export function AssignPicModal({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const data = useDemoStore((s) => s.data);
  const assignPic = useDemoStore((s) => s.assignPic);
  const L = useLookups();
  const c = data.cases.find((x) => x.id === caseId)!;
  const ranked = useMemo(() => recommendPics(c, data.users), [c, data.users]);
  const [selected, setSelected] = useState<string>(ranked.find((r) => r.userId !== c.currentOwnerId)?.userId ?? '');
  const [reason, setReason] = useState('');
  const isOverride = !!selected && ranked[0]?.userId !== selected;

  const submit = () => {
    if (!selected) return;
    if (report(assignPic(caseId, selected, reason), `มอบหมาย PIC: ${L.userName(selected)}`)) onClose();
  };

  return (
    <Modal
      title={`มอบหมาย PIC (Case: ${c.caseNumber})`}
      onClose={onClose}
      width={860}
      footer={
        <>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" disabled={!selected || selected === c.currentOwnerId} onClick={submit}>มอบหมาย</Button>
        </>
      }
    >
      <p className="muted small">
        คะแนนแนะนำ = ทักษะ 35% + ภาระงาน 30% + ความพร้อม 20% + ประสบการณ์ 15% · ผู้สมัครคือ PIC / Supervisor ของแผนก {L.depName(c.currentDepartmentId)}{' '}
        <DemoTag>DEMO LOGIC</DemoTag> คะแนนใช้ประกอบการตัดสินใจเท่านั้น ผู้จัดการเป็นคนยืนยัน
      </p>
      {ranked.length === 0 ? (
        <EmptyState title="ไม่มี PIC ที่มอบหมายได้ในแผนกนี้" hint="ถ้าต้องการให้แผนกอื่นช่วย ให้ใช้ Escalate" />
      ) : (
        <fieldset className="cand-list">
          <legend className="sr-only">เลือก PIC</legend>
          {ranked.map((r) => {
            const u = L.user(r.userId)!;
            const current = r.userId === c.currentOwnerId;
            return (
              <label key={r.userId} className={`cand ${selected === r.userId ? 'selected' : ''} ${current ? 'is-current' : ''}`}>
                <input type="radio" name="pic" value={r.userId} checked={selected === r.userId} disabled={current} onChange={() => setSelected(r.userId)} />
                <Avatar name={u.name} size={34} />
                <div className="cand-who">
                  <strong>{u.name}</strong>
                  {r.recommended && <Chip tone="blue"><Star size={11} aria-hidden="true" /> แนะนำ</Chip>}
                  {current && <Chip tone="gray">PIC ปัจจุบัน</Chip>}
                  <div className="muted small">
                    {L.teamName(u.teamId)} · {u.role === 'SUPERVISOR' ? 'Supervisor' : 'PIC'} · {AVAILABILITY_LABEL[u.availability]} · ภาระงาน {u.workload}% · {u.experienceYears} ปี
                  </div>
                  <div className="muted small">ทักษะตรง: {r.matchedSkills.length ? r.matchedSkills.join(', ') : 'ไม่มี'} (ต้องการ {c.requiredSkills.join(', ') || '—'})</div>
                </div>
                <div className="cand-factors" aria-label="คะแนนแยกตามปัจจัย">
                  {FACTORS.map(([k, label, w]) => (
                    <div key={k} className="factor">
                      <span className="factor-label">{label} {Math.round(w * 100)}%</span>
                      <span className="factor-bar"><span style={{ width: `${r.factors[k]}%` }} /></span>
                      <span className="factor-val">{Math.round(r.factors[k])}</span>
                    </div>
                  ))}
                </div>
                <div className="cand-total"><span className="score">{r.total}</span><span className="muted small">/100</span></div>
              </label>
            );
          })}
        </fieldset>
      )}
      <Field label={isOverride ? 'เหตุผลที่ไม่เลือกคนที่ระบบแนะนำ (ไม่บังคับ)' : 'หมายเหตุ (ไม่บังคับ)'} htmlFor="pic-reason">
        <input id="pic-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={isOverride ? 'เช่น ลูกค้าเคยคุยกับคนนี้' : ''} />
      </Field>
    </Modal>
  );
}
