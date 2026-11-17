import { useMemo, useState } from 'react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { canSeeTask } from '../../utils/permissions';
import { TASK_STATUS_LABEL } from '../../utils/labels';
import { isTaskOpen } from '../../utils/transitions';
import { ms } from '../../utils/time';
import { TASK_STATUSES } from '../../types/domain';
import { Card } from '../../components/common/ui';
import { TasksTable } from './TasksTable';

export function TasksPage() {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const [status, setStatus] = useState('OPEN_ALL');
  const [dep, setDep] = useState('ALL');
  const [team, setTeam] = useState('ALL');
  const [due, setDue] = useState('ALL');
  const [scope, setScope] = useState(me.role === 'PIC_AGENT' ? 'MINE' : 'ALL');

  const tasks = useMemo(
    () =>
      data.tasks
        .filter((t) => canSeeTask(data, me, t))
        .filter((t) => (status === 'ALL' ? true : status === 'OPEN_ALL' ? isTaskOpen(t.status) : t.status === status))
        .filter((t) => dep === 'ALL' || t.assignedDepartmentId === dep)
        .filter((t) => team === 'ALL' || t.assignedTeamId === team)
        .filter((t) => {
          if (due === 'ALL') return true;
          const d = ms(t.dueAt) - ms(now);
          if (due === 'OVERDUE') return isTaskOpen(t.status) && d < 0;
          return d >= 0 && d <= 24 * 3600_000;
        })
        .filter((t) => scope === 'ALL' || t.assignedUserId === me.id),
    [data, now, me, status, dep, team, due, scope],
  );

  return (
    <Card title={`งานภายใน (${tasks.length})`}>
      <div className="filters">
        <select aria-label="สถานะงาน" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="OPEN_ALL">ยังไม่เสร็จ</option>
          <option value="ALL">ทุกสถานะ</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="แผนก" value={dep} onChange={(e) => { setDep(e.target.value); setTeam('ALL'); }}>
          <option value="ALL">ทุกแผนก</option>
          {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select aria-label="ทีม" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="ALL">ทุกทีม</option>
          {data.teams.filter((t) => dep === 'ALL' || t.departmentId === dep).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="กำหนดเสร็จ" value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="ALL">ทุกกำหนดเสร็จ</option>
          <option value="OVERDUE">เลยกำหนด</option>
          <option value="24H">ภายใน 24 ชม.</option>
        </select>
        <select aria-label="ขอบเขต" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="ALL">ทุกงานที่เห็นได้</option>
          <option value="MINE">งานของฉัน</option>
        </select>
      </div>
      <p className="muted small">สร้างงานใหม่ได้จากหน้า Case หรือการ์ด Escalation · คลิกชื่องานเพื่อดูรายละเอียดและความคิดเห็นภายใน</p>
      <TasksTable tasks={tasks} />
    </Card>
  );
}
