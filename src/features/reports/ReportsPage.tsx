import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { can } from '../../utils/permissions';
import { AVAILABILITY_LABEL, ESCALATION_STATUS_LABEL } from '../../utils/labels';
import { isCaseOpen, isEscalationActive, isTaskOpen } from '../../utils/transitions';
import { formatDuration, ms } from '../../utils/time';
import { computeSla } from '../../utils/sla';
import { ESCALATION_STATUSES } from '../../types/domain';
import { Card, Restricted } from '../../components/common/ui';
import { DemoTag, EscalationChip } from '../../components/common/Chip';
import { BarList } from './BarList';
import { RANGE_LABEL, rangeStart, scoped, slaCounts, type RangeKey } from './metrics';

export function ReportsPage() {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const L = useLookups();
  const [range, setRange] = useState<RangeKey>('7');
  const S = useMemo(() => scoped(data, me), [data, me]);
  if (!can(me, 'reports.view')) return <Restricted message="บทบาท PIC ไม่เห็นรายงานภาพรวม" />;

  const start = rangeStart(now, Number(range));
  const opened = S.cases.filter((c) => ms(c.createdAt) >= start).length;
  const resolvedInRange = S.cases.filter((c) => c.resolvedAt && !isCaseOpen(c.status) && ms(c.resolvedAt) >= start);
  const metInRange = resolvedInRange.filter((c) => computeSla(c, now).state !== 'BREACHED').length;
  const sla = slaCounts(S.cases, now);
  const openCases = S.cases.filter((c) => isCaseOpen(c.status));
  const activeEsc = S.escalations.filter((e) => isEscalationActive(e.status)).sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  const pics = data.users.filter((u) => u.role === 'PIC_AGENT' || u.role === 'SUPERVISOR');

  return (
    <div className="stack">
      <div className="page-tools">
        <p className="muted small">รายงานคำนวณสดจากข้อมูลเดโม่ในเบราว์เซอร์นี้ <DemoTag>SIMULATED</DemoTag> · ไม่มีการส่งออกหรือส่งรายงานตามรอบ</p>
        <label className="inline small">
          ช่วงเวลา
          <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => <option key={k} value={k}>{RANGE_LABEL[k]}</option>)}
          </select>
        </label>
      </div>

      <div className="kpis">
        <Stat label="บทสนทนาทั้งหมด" value={S.conversations.length} />
        <Stat label={`Case เปิดใหม่ (${RANGE_LABEL[range]})`} value={opened} />
        <Stat label={`Case แก้ไขแล้ว (${RANGE_LABEL[range]})`} value={resolvedInRange.length} sub={resolvedInRange.length ? `ทัน SLA ${Math.round((metInRange / resolvedInRange.length) * 100)}%` : 'ยังไม่มี'} />
        <Stat label="Escalation ที่ยังไม่จบ" value={activeEsc.length} />
      </div>

      <div className="grid-2 gap">
        <Card title="SLA ของ Case ที่เปิดอยู่">
          <BarList rows={[
            { key: 'ON_TRACK', label: 'On track', value: sla.open.ON_TRACK },
            { key: 'AT_RISK', label: 'At risk', value: sla.open.AT_RISK },
            { key: 'BREACHED', label: 'Breached', value: sla.open.BREACHED },
            { key: 'PAUSED', label: 'Paused', value: sla.open.PAUSED },
          ]} />
          <p className="muted small">Case ที่ปิดแล้วทั้งหมด: ทัน SLA {sla.finished.met} · เกิน SLA {sla.finished.breached}</p>
        </Card>
        <Card title="Case เปิดอยู่ตามแผนกที่ดูแล">
          <BarList rows={data.departments.map((d) => ({ key: d.id, label: d.name, value: openCases.filter((c) => c.currentDepartmentId === d.id).length }))} />
        </Card>
        <Card title="Case ตาม LINE OA ต้นทาง">
          <BarList rows={data.channels.map((ch) => ({ key: ch.id, label: ch.name, value: S.cases.filter((c) => c.originalChannelId === ch.id).length, hint: `(เปิด ${openCases.filter((c) => c.originalChannelId === ch.id).length})` }))} />
        </Card>
        <Card title="Escalation ตามสถานะ">
          <BarList rows={ESCALATION_STATUSES.map((s) => ({ key: s, label: ESCALATION_STATUS_LABEL[s], value: S.escalations.filter((e) => e.status === s).length }))} />
        </Card>
      </div>

      <Card title="ภาระงานราย PIC">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>PIC</th><th>แผนก / ทีม</th><th>สถานะ</th><th>Case ที่ถือ (เปิด)</th><th>งานภายในค้าง</th><th>ภาระงาน</th></tr></thead>
            <tbody>
              {pics.map((u) => {
                const owned = openCases.filter((c) => c.currentOwnerId === u.id).length;
                const tasks = S.tasks.filter((t) => t.assignedUserId === u.id && isTaskOpen(t.status)).length;
                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{L.depName(u.departmentId)}<div className="muted small">{L.teamName(u.teamId)}</div></td>
                    <td>{AVAILABILITY_LABEL[u.availability]}</td>
                    <td>{owned}</td>
                    <td>{tasks}</td>
                    <td><span className="meter" aria-hidden="true"><span style={{ width: `${u.workload}%` }} /></span> {u.workload}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">ภาระงาน % เป็นค่าจำลอง ปรับ +5% เมื่อได้รับ Case และ −5% เมื่อถูกย้ายออก</p>
      </Card>

      <Card title="อายุ Escalation ที่ยังไม่จบ (เก่าสุดก่อน)">
        {activeEsc.length === 0 ? <p className="muted">ไม่มี Escalation ค้าง</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Case</th><th>เส้นทาง</th><th>สถานะ</th><th>อายุ</th><th>งานค้าง</th></tr></thead>
              <tbody>
                {activeEsc.map((e) => {
                  const c = data.cases.find((x) => x.id === e.caseId)!;
                  return (
                    <tr key={e.id}>
                      <td><Link className="mono link" to={`/cases/${c.id}?tab=escalation`}>{c.caseNumber}</Link></td>
                      <td>{L.depName(e.fromDepartmentId)} → {L.depName(e.toDepartmentId)}</td>
                      <td><EscalationChip status={e.status} /></td>
                      <td>{formatDuration(ms(now) - ms(e.createdAt))}</td>
                      <td>{S.tasks.filter((t) => t.escalationId === e.id && isTaskOpen(t.status)).length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="kpi static">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}
