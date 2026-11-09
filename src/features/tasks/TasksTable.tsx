import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { isTaskOpen } from '../../utils/transitions';
import { formatDateTime, ms } from '../../utils/time';
import type { InternalTask } from '../../types/domain';
import { EmptyState } from '../../components/common/ui';
import { Chip, TaskChip } from '../../components/common/Chip';
import { TaskDrawer } from './TaskDrawer';

export function TasksTable({ tasks, hideCase }: { tasks: InternalTask[]; hideCase?: boolean }) {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const L = useLookups();
  const [open, setOpen] = useState<string | null>(null);
  if (!tasks.length) return <EmptyState icon={<ClipboardList size={28} />} title="ไม่มีงานภายใน" />;
  const sorted = [...tasks].sort((a, b) => Number(isTaskOpen(b.status)) - Number(isTaskOpen(a.status)) || ms(a.dueAt) - ms(b.dueAt));
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>งาน</th>
              {!hideCase && <th>Case</th>}
              <th>แผนก / ทีม</th>
              <th>ผู้รับผิดชอบ</th>
              <th>กำหนดเสร็จ</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const c = data.cases.find((x) => x.id === t.caseId);
              const overdue = isTaskOpen(t.status) && ms(t.dueAt) < ms(now);
              const comments = data.comments.filter((x) => x.taskId === t.id).length;
              return (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="link-btn" onClick={() => setOpen(t.id)}>{t.title}</button>
                    <div className="muted small">{t.escalationId ? 'จาก Escalation · ' : ''}{comments ? `${comments} ความคิดเห็น` : 'ยังไม่มีความคิดเห็น'}</div>
                  </td>
                  {!hideCase && <td>{c && <Link to={`/cases/${c.id}?tab=tasks`} className="mono link">{c.caseNumber}</Link>}</td>}
                  <td>{L.depName(t.assignedDepartmentId)}<div className="muted small">{L.teamName(t.assignedTeamId)}</div></td>
                  <td>{L.userName(t.assignedUserId)}</td>
                  <td className="nowrap">{formatDateTime(t.dueAt)} {overdue && <Chip tone="red">เลยกำหนด</Chip>}</td>
                  <td><TaskChip status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <TaskDrawer taskId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
