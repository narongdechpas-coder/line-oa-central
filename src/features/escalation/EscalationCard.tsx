import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardPlus } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { canCancelEscalation, canDecideEscalation, canWorkEscalation, canWorkOnCase } from '../../utils/permissions';
import { allowedEscalationActions, isEscalationActive, isTaskOpen, type EscalationAction } from '../../utils/transitions';
import { formatDateTime } from '../../utils/time';
import { Button, Field } from '../../components/common/ui';
import { EscalationChip, TaskChip } from '../../components/common/Chip';
import { ConfirmDialog } from '../../components/overlays/Modal';
import { ChannelBadge } from '../channels/ChannelBadge';
import { CreateTaskModal } from '../tasks/CreateTaskModal';

const ACTION_LABEL: Record<EscalationAction, string> = {
  REVIEW: 'เริ่มพิจารณา',
  ACCEPT: 'รับเรื่อง (Accept)',
  REJECT: 'ปฏิเสธ (Reject)',
  START: 'เริ่มดำเนินการ',
  RESOLVE: 'Resolve',
  CANCEL: 'ยกเลิกคำขอ',
};

export function EscalationCard({ escalationId, showCase, showHistory }: { escalationId: string; showCase?: boolean; showHistory?: boolean }) {
  const data = useDemoStore((s) => s.data);
  const act = useDemoStore((s) => s.escalationAction);
  const me = useActingUser();
  const L = useLookups();
  const [confirm, setConfirm] = useState<null | 'REJECT' | 'CANCEL'>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);

  const e = data.escalations.find((x) => x.id === escalationId);
  if (!e) return null;
  const c = data.cases.find((x) => x.id === e.caseId)!;
  const tasks = data.tasks.filter((t) => t.escalationId === e.id);
  const openTasks = tasks.filter((t) => isTaskOpen(t.status)).length;

  const permitted = (a: EscalationAction) =>
    a === 'CANCEL' ? canCancelEscalation(me, e) : a === 'START' || a === 'RESOLVE' ? canWorkEscalation(data, me, e) : canDecideEscalation(me, e);
  const actions = allowedEscalationActions(e.status);
  const run = (a: EscalationAction, n?: string) => report(act(e.id, a, n), `${ACTION_LABEL[a]} แล้ว`);
  const canAddTask = (e.status === 'ACCEPTED' || e.status === 'IN_PROGRESS') && canWorkOnCase(data, me, c, 'task.create');

  const history = showHistory
    ? data.timeline
        .filter((t) => t.caseId === c.id && (t.type === 'ESCALATED' || t.type === 'ESCALATION_UPDATED') && Date.parse(t.createdAt) >= Date.parse(e.createdAt) && (isEscalationActive(e.status) || !e.updatedAt || Date.parse(t.createdAt) <= Date.parse(e.updatedAt)))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    : [];

  return (
    <article className="esc-card">
      <header className="esc-head">
        <div className="esc-route">
          <span>{L.depName(e.fromDepartmentId)}</span>
          <ArrowRight size={14} aria-label="ส่งไปยัง" />
          <strong>{L.depName(e.toDepartmentId)}</strong>
          <span className="muted small">/ {L.teamName(e.toTeamId)}</span>
        </div>
        <EscalationChip status={e.status} />
      </header>
      {showCase && (
        <p className="esc-case">
          <Link to={`/cases/${c.id}?tab=escalation`} className="mono link">{c.caseNumber}</Link> {c.title} · ลูกค้ายังอยู่ที่ <ChannelBadge channelId={c.originalChannelId} small />
        </p>
      )}
      <p className="esc-reason">{e.reason}</p>
      <dl className="esc-meta">
        <div><dt>ขอโดย</dt><dd>{L.userName(e.requestedBy)} · {formatDateTime(e.createdAt)}</dd></div>
        <div><dt>ผู้รับผิดชอบที่ขอ</dt><dd>{e.requestedOwnerId ? L.userName(e.requestedOwnerId) : '—'}</dd></div>
        <div><dt>งานภายใน</dt><dd>{tasks.length ? `${tasks.length} งาน (ค้าง ${openTasks})` : 'ยังไม่มี'}</dd></div>
        {e.decisionNote && <div><dt>หมายเหตุการตัดสินใจ</dt><dd>{e.decisionNote}</dd></div>}
      </dl>
      {tasks.length > 0 && (
        <ul className="esc-tasks">
          {tasks.map((t) => <li key={t.id}><TaskChip status={t.status} /> {t.title} <span className="muted small">— {L.userName(t.assignedUserId)}</span></li>)}
        </ul>
      )}
      {(actions.length > 0 || canAddTask) && (
        <div className="esc-actions">
          {actions.map((a) => {
            const ok = permitted(a);
            const blocked = a === 'RESOLVE' && openTasks > 0;
            const title = !ok ? (a === 'CANCEL' ? 'ยกเลิกได้เฉพาะผู้ขอหรือผู้จัดการแผนกต้นทาง' : 'เฉพาะ Manager / Supervisor ของแผนกปลายทาง') : blocked ? `ยังมีงานค้าง ${openTasks} งาน` : undefined;
            return (
              <Button
                key={a}
                size="sm"
                variant={a === 'ACCEPT' || a === 'RESOLVE' || a === 'START' ? 'primary' : a === 'REJECT' ? 'danger' : 'secondary'}
                disabled={!ok || blocked}
                title={title}
                onClick={() => (a === 'REJECT' || a === 'CANCEL' ? setConfirm(a) : run(a))}
              >
                {ACTION_LABEL[a]}
              </Button>
            );
          })}
          {canAddTask && <Button size="sm" icon={<ClipboardPlus size={14} />} onClick={() => setTaskOpen(true)}>สร้างงานให้แผนกปลายทาง</Button>}
        </div>
      )}
      {!actions.some(permitted) && actions.length > 0 && <p className="muted small">บทบาทปัจจุบันทำรายการกับ Escalation นี้ไม่ได้ — ลองสลับเป็น Manager ของ {L.depName(e.toDepartmentId)}</p>}
      {history.length > 0 && (
        <ol className="timeline compact">
          {history.map((t) => <li key={t.id}><span className="tl-dot" aria-hidden="true" /><div><p>{t.label}</p><p className="muted small">{formatDateTime(t.createdAt)}{t.actorId ? ` · ${L.userName(t.actorId)}` : ''}</p></div></li>)}
        </ol>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm === 'REJECT' ? 'ปฏิเสธ Escalation?' : 'ยกเลิก Escalation?'}
          message={confirm === 'REJECT' ? 'Case จะกลับไปอยู่กับแผนกต้นทางในสถานะเดิม' : 'คำขอจะถูกยกเลิก Case กลับไปอยู่กับแผนกต้นทาง'}
          confirmLabel={confirm === 'REJECT' ? 'ปฏิเสธ' : 'ยกเลิกคำขอ'}
          danger
          onCancel={() => { setConfirm(null); setNote(''); setNoteError(null); }}
          onConfirm={() => {
            if (confirm === 'REJECT' && !note.trim()) {
              setNoteError('กรุณาระบุเหตุผลที่ปฏิเสธ');
              return;
            }
            if (run(confirm, note)) { setConfirm(null); setNote(''); }
          }}
        >
          <Field label={confirm === 'REJECT' ? 'เหตุผลที่ปฏิเสธ' : 'หมายเหตุ (ไม่บังคับ)'} htmlFor={`note-${e.id}`} required={confirm === 'REJECT'} error={noteError}>
            <textarea id={`note-${e.id}`} rows={2} value={note} onChange={(ev) => { setNote(ev.target.value); setNoteError(null); }} />
          </Field>
        </ConfirmDialog>
      )}
      {taskOpen && <CreateTaskModal caseId={c.id} escalationId={e.id} onClose={() => setTaskOpen(false)} onDone={() => setTaskOpen(false)} />}
    </article>
  );
}
