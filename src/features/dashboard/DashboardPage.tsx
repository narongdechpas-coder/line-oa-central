import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlarmClock, Briefcase, CheckCircle2, MessageCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { CASE_STATUSES } from '../../types/domain';
import { CASE_STATUS_LABEL } from '../../utils/labels';
import { isCaseOpen } from '../../utils/transitions';
import { formatDateTime, ms } from '../../utils/time';
import { Card } from '../../components/common/ui';
import { DemoTag } from '../../components/common/Chip';
import { BarList } from '../reports/BarList';
import { RANGE_LABEL, casesPerDay, rangeStart, scoped, slaCounts, type RangeKey } from '../reports/metrics';

export function DashboardPage() {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const L = useLookups();
  const nav = useNavigate();
  const [range, setRange] = useState<RangeKey>('7');
  const S = useMemo(() => scoped(data, me), [data, me]);
  const start = rangeStart(now, Number(range));

  const unread = S.conversations.reduce((n, c) => n + c.unread, 0);
  const openCases = S.cases.filter((c) => isCaseOpen(c.status));
  const sla = slaCounts(S.cases, now);
  const resolved = S.cases.filter((c) => c.resolvedAt && !isCaseOpen(c.status) && ms(c.resolvedAt) >= start).length;
  const trend = useMemo(() => casesPerDay(S.cases, now, Number(range)), [S.cases, now, range]);
  const recent = [...S.timeline].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 8);

  return (
    <div className="stack">
      <div className="page-tools">
        <p className="muted small">ข้อมูลจำลองทั้งหมด <DemoTag>SIMULATED</DemoTag> · ขอบเขตตามบทบาทเดโม่ปัจจุบัน</p>
        <label className="inline small">
          ช่วงเวลา
          <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => <option key={k} value={k}>{RANGE_LABEL[k]}</option>)}
          </select>
        </label>
      </div>

      <div className="kpis">
        <Kpi icon={<MessageCircle size={20} />} label="ข้อความใหม่ (ยังไม่อ่าน)" value={unread} to="/inbox" />
        <Kpi icon={<Briefcase size={20} />} label="Case ที่เปิดอยู่" value={openCases.length} to="/cases?status=OPEN" />
        <Kpi icon={<AlarmClock size={20} />} label="SLA ใกล้ครบ / เกินกำหนด" value={sla.open.AT_RISK + sla.open.BREACHED} sub={`At risk ${sla.open.AT_RISK} · Breached ${sla.open.BREACHED}`} to="/cases?status=OPEN&sla=RISK" />
        <Kpi icon={<CheckCircle2 size={20} />} label={`Case ที่แก้ไขแล้ว (${RANGE_LABEL[range]})`} value={resolved} to="/cases?status=DONE" />
      </div>

      <div className="grid-dash">
        <Card title={`Case ใหม่ต่อวัน (${RANGE_LABEL[range]})`}>
          <div className="chart" role="img" aria-label={`จำนวน Case ใหม่ต่อวัน: ${trend.map((t) => `${t.label} ${t.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: 'var(--hover)' }} formatter={(v) => [`${v} Case`, 'สร้างใหม่']} labelFormatter={(l) => `วันที่ ${l}`} />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="สถานะ Case">
          <BarList
            rows={CASE_STATUSES.map((s) => ({ key: s, label: CASE_STATUS_LABEL[s], value: S.cases.filter((c) => c.status === s).length }))}
            onSelect={(k) => nav(`/cases?status=${k}`)}
          />
        </Card>

        <Card title="ปริมาณงานตาม LINE OA">
          <div className="ch-cards">
            {data.channels.map((ch) => {
              const convs = S.conversations.filter((c) => c.channelId === ch.id);
              const cs = openCases.filter((c) => c.originalChannelId === ch.id);
              return (
                <Link key={ch.id} to={`/inbox?channel=${ch.id}`} className="ch-card">
                  <span className="ch-card-name"><span className="ch-dot" style={{ background: ch.color }} aria-hidden="true" />{ch.name}</span>
                  <span className="muted small">{L.depName(ch.departmentId)}</span>
                  <span className="ch-card-stats"><strong>{convs.length}</strong> บทสนทนา · <strong>{cs.length}</strong> Case เปิด · <strong>{convs.reduce((n, c) => n + c.unread, 0)}</strong> ยังไม่อ่าน</span>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card title="ความเคลื่อนไหวล่าสุด">
          <ol className="timeline compact">
            {recent.map((t) => {
              const c = data.cases.find((x) => x.id === t.caseId);
              return (
                <li key={t.id}>
                  <span className="tl-dot" aria-hidden="true" />
                  <div>
                    <p><Link to={`/cases/${t.caseId}`} className="mono link">{c?.caseNumber}</Link> {t.label}</p>
                    <p className="muted small">{formatDateTime(t.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card title="ทางลัด">
          <div className="btn-col">
            <Link className="btn btn-primary btn-md" to="/inbox">เปิด Inbox</Link>
            <Link className="btn btn-secondary btn-md" to="/cases?status=OPEN">ดู Case ที่เปิดอยู่</Link>
            <Link className="btn btn-secondary btn-md" to="/cases?status=OPEN&sla=RISK">ดู SLA ที่ต้องเร่ง</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, to }: { icon: React.ReactNode; label: string; value: number; sub?: string; to: string }) {
  return (
    <Link to={to} className="kpi">
      <span className="kpi-icon" aria-hidden="true">{icon}</span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </Link>
  );
}
