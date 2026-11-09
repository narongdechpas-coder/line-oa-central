import { useMemo, useState } from 'react';
import { MessageSquareShare } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { canDecideEscalation, canSeeCase } from '../../utils/permissions';
import { ESCALATION_STATUS_LABEL } from '../../utils/labels';
import { isEscalationActive } from '../../utils/transitions';
import { ESCALATION_STATUSES } from '../../types/domain';
import { Card, EmptyState } from '../../components/common/ui';
import { EscalationCard } from './EscalationCard';

export function EscalationsPage() {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const [status, setStatus] = useState('ACTIVE');
  const [dep, setDep] = useState('ALL');
  const [mine, setMine] = useState(false);

  const list = useMemo(
    () =>
      data.escalations
        .filter((e) => {
          const c = data.cases.find((x) => x.id === e.caseId);
          return c && canSeeCase(data, me, c);
        })
        .filter((e) => (status === 'ALL' ? true : status === 'ACTIVE' ? isEscalationActive(e.status) : e.status === status))
        .filter((e) => dep === 'ALL' || e.toDepartmentId === dep || e.fromDepartmentId === dep)
        .filter((e) => !mine || canDecideEscalation(me, e))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [data, me, status, dep, mine],
  );

  return (
    <Card title={`Internal Escalations (${list.length})`}>
      <div className="filters">
        <select aria-label="สถานะ" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">ยังไม่จบ</option>
          <option value="ALL">ทั้งหมด</option>
          {ESCALATION_STATUSES.map((s) => <option key={s} value={s}>{ESCALATION_STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="แผนก" value={dep} onChange={(e) => setDep(e.target.value)}>
          <option value="ALL">ทุกแผนก</option>
          {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> เฉพาะที่ฉันพิจารณาได้
        </label>
      </div>
      <p className="muted small">Escalation คือการส่งต่องานภายในเท่านั้น ลูกค้ายังคุยผ่าน LINE OA เดิมเสมอ</p>
      {list.length === 0 ? (
        <EmptyState icon={<MessageSquareShare size={28} />} title="ไม่มี Escalation ตามตัวกรอง" />
      ) : (
        <div className="esc-grid">
          {list.map((e) => <EscalationCard key={e.id} escalationId={e.id} showCase />)}
        </div>
      )}
    </Card>
  );
}
