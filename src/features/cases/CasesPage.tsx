import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { visibleCases } from '../../services/mock/queries';
import { computeSla } from '../../utils/sla';
import { isCaseOpen } from '../../utils/transitions';
import { CASE_STATUS_LABEL, PRIORITY_LABEL, SLA_LABEL } from '../../utils/labels';
import { formatDateTime } from '../../utils/time';
import { CASE_STATUSES, PRIORITIES, SLA_STATES } from '../../types/domain';
import { CaseStatusChip, PriorityChip, SlaChip } from '../../components/common/Chip';
import { Card, EmptyState } from '../../components/common/ui';
import { ChannelBadge } from '../channels/ChannelBadge';

/** Filters live in the URL so Dashboard cards can deep-link (e.g. ?status=OPEN&sla=RISK). */
export function CasesPage() {
  const [params, setParams] = useSearchParams();
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const L = useLookups();
  const get = (k: string) => params.get(k) ?? 'ALL';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (!v || v === 'ALL') p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };
  const q = (params.get('q') ?? '').trim().toLowerCase();

  const rows = useMemo(() => {
    return visibleCases(data, me)
      .map((c) => ({ c, sla: computeSla(c, now) }))
      .filter(({ c }) => {
        const st = get('status');
        if (st === 'ALL') return true;
        if (st === 'OPEN') return isCaseOpen(c.status);
        if (st === 'DONE') return !isCaseOpen(c.status);
        return c.status === st;
      })
      .filter(({ c }) => get('priority') === 'ALL' || c.priority === get('priority'))
      .filter(({ sla }) => {
        const s = get('sla');
        if (s === 'ALL') return true;
        if (s === 'RISK') return sla.state === 'AT_RISK' || sla.state === 'BREACHED';
        return sla.state === s;
      })
      .filter(({ c }) => get('channel') === 'ALL' || c.originalChannelId === get('channel'))
      .filter(({ c }) => get('dep') === 'ALL' || c.currentDepartmentId === get('dep'))
      .filter(({ c }) => {
        if (!q) return true;
        const cus = L.customer(c.originalCustomerId);
        return `${c.caseNumber} ${c.title} ${c.category} ${cus?.displayName ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Date.parse(b.c.createdAt) - Date.parse(a.c.createdAt));
  }, [data, now, me, params]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title={`Cases (${rows.length})`}>
      <div className="filters">
        <input aria-label="ค้นหา Case" placeholder="ค้นหาเลข Case, หัวข้อ, ลูกค้า…" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} />
        <select aria-label="สถานะ" value={get('status')} onChange={(e) => set('status', e.target.value)}>
          <option value="ALL">ทุกสถานะ</option>
          <option value="OPEN">ยังเปิดอยู่ทั้งหมด</option>
          <option value="DONE">แก้ไข/ปิดแล้ว</option>
          {CASE_STATUSES.map((s) => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="ความสำคัญ" value={get('priority')} onChange={(e) => set('priority', e.target.value)}>
          <option value="ALL">ทุกความสำคัญ</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <select aria-label="SLA" value={get('sla')} onChange={(e) => set('sla', e.target.value)}>
          <option value="ALL">ทุก SLA</option>
          <option value="RISK">At risk + Breached</option>
          {SLA_STATES.map((s) => <option key={s} value={s}>{SLA_LABEL[s]}</option>)}
        </select>
        <select aria-label="LINE OA ต้นทาง" value={get('channel')} onChange={(e) => set('channel', e.target.value)}>
          <option value="ALL">ทุก OA</option>
          {data.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="แผนกที่ดูแล" value={get('dep')} onChange={(e) => set('dep', e.target.value)}>
          <option value="ALL">ทุกแผนก</option>
          {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {params.toString() && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>ล้างตัวกรอง</button>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Briefcase size={28} />} title="ไม่พบ Case" hint={q ? `ไม่มีผลลัพธ์สำหรับ “${q}”` : 'ลองเปลี่ยนตัวกรอง หรือสร้าง Case จาก Inbox'} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Case</th>
                <th>หัวข้อ</th>
                <th>ลูกค้า / OA ต้นทาง</th>
                <th>สถานะ</th>
                <th>ความสำคัญ</th>
                <th>แผนก / PIC ปัจจุบัน</th>
                <th>SLA</th>
                <th>กำหนด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, sla }) => (
                <tr key={c.id}>
                  <td><Link to={`/cases/${c.id}`} className="mono link">{c.caseNumber}</Link></td>
                  <td>{c.title}<div className="muted small">{c.category}</div></td>
                  <td>{L.customer(c.originalCustomerId)?.displayName}<div><ChannelBadge channelId={c.originalChannelId} small /></div></td>
                  <td><CaseStatusChip status={c.status} /></td>
                  <td><PriorityChip priority={c.priority} /></td>
                  <td>{L.depName(c.currentDepartmentId)}<div className="muted small">{L.userName(c.currentOwnerId)}</div></td>
                  <td><SlaChip state={sla.state} /></td>
                  <td className="nowrap small">{formatDateTime(c.dueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">SLA ทั้งหมดเป็นค่าจำลอง (SIMULATED) คำนวณจากนาฬิกาเดโม่</p>
    </Card>
  );
}
