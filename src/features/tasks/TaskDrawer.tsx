import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { canUpdateTask } from '../../utils/permissions';
import { TASK_TRANSITIONS, isTaskOpen } from '../../utils/transitions';
import { formatDateTime, fromBangkokInput, toBangkokInput } from '../../utils/time';
import type { TaskStatus } from '../../types/domain';
import { Modal } from '../../components/overlays/Modal';
import { Avatar, Button, Field, KeyValue } from '../../components/common/ui';
import { DemoTag, TaskChip } from '../../components/common/Chip';

const ACTION: Partial<Record<TaskStatus, string>> = {
  IN_PROGRESS: 'เริ่มทำ / ทำต่อ',
  BLOCKED: 'ติดปัญหา',
  DONE: 'เสร็จแล้ว',
  CANCELLED: 'ยกเลิกงาน',
};

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const data = useDemoStore((s) => s.data);
  const updateTask = useDemoStore((s) => s.updateTask);
  const addComment = useDemoStore((s) => s.addComment);
  const me = useActingUser();
  const L = useLookups();
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const t = data.tasks.find((x) => x.id === taskId);
  if (!t) return null;
  const c = data.cases.find((x) => x.id === t.caseId)!;
  const editable = canUpdateTask(data, me, t) && isTaskOpen(t.status);
  const comments = data.comments.filter((x) => x.taskId === t.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const deptUsers = data.users.filter((u) => u.departmentId === t.assignedDepartmentId && u.role !== 'DEPARTMENT_ADMIN');

  const post = () => {
    const r = addComment(t.id, body);
    if (r.ok) {
      setBody('');
      setErr(null);
      report(r, 'บันทึกความคิดเห็นภายในแล้ว');
    } else setErr(r.error);
  };

  return (
    <Modal title={t.title} onClose={onClose} side>
      <div className="stack">
        <div className="inline"><TaskChip status={t.status} /> <span className="muted small">งานภายใน · <Link className="link" to={`/cases/${c.id}?tab=tasks`} onClick={onClose}>{c.caseNumber}</Link></span></div>
        {t.description && <p>{t.description}</p>}
        <KeyValue
          items={[
            ['แผนก / ทีม', `${L.depName(t.assignedDepartmentId)} / ${L.teamName(t.assignedTeamId)}`],
            [
              'ผู้รับผิดชอบ',
              editable ? (
                <select key="u" aria-label="มอบงานให้" value={t.assignedUserId ?? ''} onChange={(e) => report(updateTask(t.id, { assignedUserId: e.target.value || null }), 'มอบหมายงานแล้ว')}>
                  <option value="">— ยังไม่ระบุ —</option>
                  {deptUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                L.userName(t.assignedUserId)
              ),
            ],
            [
              'กำหนดเสร็จ',
              editable ? (
                <input key="d" aria-label="กำหนดเสร็จ" type="datetime-local" value={toBangkokInput(t.dueAt)} onChange={(e) => e.target.value && report(updateTask(t.id, { dueAt: fromBangkokInput(e.target.value) }), 'เปลี่ยนกำหนดเสร็จแล้ว')} />
              ) : (
                formatDateTime(t.dueAt)
              ),
            ],
            ['Escalation', t.escalationId ? 'งานจากการส่งต่อภายใน' : '—'],
          ]}
        />
        {editable ? (
          <div className="btn-row">
            {TASK_TRANSITIONS[t.status].map((s) => (
              <Button key={s} size="sm" variant={s === 'DONE' ? 'primary' : s === 'CANCELLED' ? 'danger' : 'secondary'} onClick={() => report(updateTask(t.id, { status: s }), `งาน: ${ACTION[s]}`)}>
                {ACTION[s]}
              </Button>
            ))}
          </div>
        ) : (
          <p className="muted small">{isTaskOpen(t.status) ? 'บทบาทนี้แก้ไขงานนี้ไม่ได้' : 'งานนี้ปิดแล้ว'}</p>
        )}

        <h3 className="side-sub"><Lock size={13} aria-hidden="true" /> ความคิดเห็นภายใน <DemoTag>INTERNAL ONLY</DemoTag></h3>
        <p className="muted small">ไม่แสดงให้ลูกค้าเห็น และไม่ถูกส่งไป LINE</p>
        <ul className="comments">
          {comments.length === 0 && <li className="muted small">ยังไม่มีความคิดเห็น</li>}
          {comments.map((cm) => (
            <li key={cm.id} className="comment">
              <Avatar name={L.userName(cm.authorId)} size={24} />
              <div>
                <p className="small"><strong>{L.userName(cm.authorId)}</strong> <span className="muted">{formatDateTime(cm.createdAt)}</span></p>
                <p>{cm.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {canUpdateTask(data, me, t) && (
          <form onSubmit={(e) => { e.preventDefault(); post(); }}>
            <Field label="เพิ่มความคิดเห็นภายใน" htmlFor="cm-body" error={err}>
              <textarea id="cm-body" rows={2} value={body} onChange={(e) => { setBody(e.target.value); setErr(null); }} />
            </Field>
            <Button type="submit" size="sm" variant="primary">บันทึกความคิดเห็น</Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
