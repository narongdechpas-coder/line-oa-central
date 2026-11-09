import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardPlus, FileText, Lock, MessageSquareShare, RefreshCw, UserCheck } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { assignmentHistory, caseTimeline, getConversation } from '../../services/mock/queries';
import { canSeeCase, canWorkOnCase } from '../../utils/permissions';
import { computeSla } from '../../utils/sla';
import {
  ASSIGNABLE_CASE_STATUSES,
  ESCALATABLE_CASE_STATUSES,
  allowedCaseTransitions,
  isCaseOpen,
  isEscalationActive,
} from '../../utils/transitions';
import { CASE_STATUS_LABEL, PRIORITY_LABEL } from '../../utils/labels';
import { formatDateTime, formatDuration } from '../../utils/time';
import { PRIORITIES, type CaseStatus, type Priority } from '../../types/domain';
import { Avatar, Button, Card, EmptyState, KeyValue, Restricted } from '../../components/common/ui';
import { CaseStatusChip, Chip, DemoTag, PriorityChip, SlaChip } from '../../components/common/Chip';
import { ConfirmDialog, Modal } from '../../components/overlays/Modal';
import { ChannelBadge } from '../channels/ChannelBadge';
import { Thread } from '../inbox/InboxPage';
import { AssignPicModal } from '../assignment/AssignPicModal';
import { EscalateModal } from '../escalation/EscalateModal';
import { EscalationCard } from '../escalation/EscalationCard';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { TasksTable } from '../tasks/TasksTable';

const TABS = [
  ['overview', 'ภาพรวม'],
  ['conversation', 'การสื่อสาร'],
  ['assignment', 'การมอบหมาย'],
  ['escalation', 'Escalation'],
  ['tasks', 'งานภายใน'],
  ['timeline', 'ประวัติ (Timeline)'],
] as const;
type Tab = (typeof TABS)[number][0];

export function CaseWorkspacePage() {
  const { caseId } = useParams();
  const [params, setParams] = useSearchParams();
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const [modal, setModal] = useState<null | 'assign' | 'escalate' | 'task' | 'status'>(null);

  const c = data.cases.find((x) => x.id === caseId);
  if (!c) return <EmptyState title="ไม่พบ Case นี้" hint="ข้อมูลอาจถูก Reset แล้ว" action={<Link className="btn btn-primary btn-md" to="/cases">กลับไปรายการ Case</Link>} />;
  if (!canSeeCase(data, me, c)) return <Restricted message={`Case ${c.caseNumber} อยู่นอกขอบเขตของบทบาทเดโม่ปัจจุบัน`} />;

  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'overview') as Tab;
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });

  const sla = computeSla(c, now);
  const activeEsc = data.escalations.find((e) => e.caseId === c.id && isEscalationActive(e.status));
  const transitions = allowedCaseTransitions(c.status, { hasActiveEscalation: !!activeEsc, hasOwner: !!c.currentOwnerId });

  const can = {
    assign: canWorkOnCase(data, me, c, 'case.assign') && ASSIGNABLE_CASE_STATUSES.includes(c.status),
    escalate: canWorkOnCase(data, me, c, 'escalation.request') && ESCALATABLE_CASE_STATUSES.includes(c.status) && !activeEsc,
    task: canWorkOnCase(data, me, c, 'task.create') && isCaseOpen(c.status),
    status: canWorkOnCase(data, me, c, 'case.update') && transitions.length > 0,
  };
  const why = (perm: boolean, stateOk: boolean, stateMsg: string) => (perm ? (stateOk ? undefined : stateMsg) : 'บทบาทเดโม่นี้ไม่มีสิทธิ์');
  const tabCount = (t: Tab) =>
    t === 'escalation' ? data.escalations.filter((e) => e.caseId === c.id).length : t === 'tasks' ? data.tasks.filter((x) => x.caseId === c.id).length : null;

  return (
    <div className="workspace">
      <div className="ws-head">
        <Link to="/cases" className="icon-btn" aria-label="กลับไปรายการ Case"><ArrowLeft size={18} /></Link>
        <div className="ws-title">
          <div className="ws-title-row">
            <h2>Case: <span className="mono">{c.caseNumber}</span></h2>
            <CaseStatusChip status={c.status} />
            <PriorityChip priority={c.priority} />
            <SlaChip state={sla.state} />
          </div>
          <p className="ws-sub">{c.title} · {c.category} · ต้นทาง <ChannelBadge channelId={c.originalChannelId} small /></p>
        </div>
        <div className="ws-actions">
          <Button icon={<UserCheck size={16} />} disabled={!can.assign} title={can.assign ? undefined : why(canWorkOnCase(data, me, c, 'case.assign'), false, `มอบหมายไม่ได้ขณะสถานะ ${CASE_STATUS_LABEL[c.status]}`)} onClick={() => setModal('assign')}>Assign PIC</Button>
          <Button icon={<MessageSquareShare size={16} />} disabled={!can.escalate} title={can.escalate ? undefined : why(canWorkOnCase(data, me, c, 'escalation.request'), false, activeEsc ? 'มี Escalation ที่ยังไม่จบ' : `Escalate ไม่ได้ขณะสถานะ ${CASE_STATUS_LABEL[c.status]}`)} onClick={() => setModal('escalate')}>Escalate</Button>
          <Button icon={<ClipboardPlus size={16} />} disabled={!can.task} title={can.task ? undefined : why(canWorkOnCase(data, me, c, 'task.create'), false, 'Case ปิดแล้ว')} onClick={() => setModal('task')}>สร้างงานภายใน</Button>
          <Button variant="primary" icon={<RefreshCw size={16} />} disabled={!can.status} title={can.status ? undefined : why(canWorkOnCase(data, me, c, 'case.update'), false, activeEsc ? 'ต้องปิด Escalation ก่อน' : !c.currentOwnerId ? 'ต้องมอบหมาย PIC ก่อน' : 'ไม่มีสถานะถัดไป')} onClick={() => setModal('status')}>เปลี่ยนสถานะ</Button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="ส่วนของ Case">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {label}{tabCount(k) ? <span className="count">{tabCount(k)}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <Overview caseId={c.id} onTab={setTab} />}
        {tab === 'conversation' && (
          <div className="ws-thread">
            <Thread conversationId={c.conversationId} />
          </div>
        )}
        {tab === 'assignment' && <AssignmentTab caseId={c.id} />}
        {tab === 'escalation' && (
          <div className="stack">
            <div className="banner info"><Lock size={14} aria-hidden="true" /> Internal handoff only — customer remains on original LINE OA ({data.channels.find((x) => x.id === c.originalChannelId)?.name})</div>
            {data.escalations.filter((e) => e.caseId === c.id).length === 0 && <EmptyState title="ยังไม่มี Escalation" hint="ใช้ปุ่ม Escalate ด้านบนเพื่อส่งต่องานภายในให้แผนกอื่น" />}
            {data.escalations
              .filter((e) => e.caseId === c.id)
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
              .map((e) => <EscalationCard key={e.id} escalationId={e.id} showHistory />)}
          </div>
        )}
        {tab === 'tasks' && (
          <Card title="งานภายในของ Case นี้" actions={can.task && <Button size="sm" variant="primary" icon={<ClipboardPlus size={14} />} onClick={() => setModal('task')}>สร้างงาน</Button>}>
            <TasksTable tasks={data.tasks.filter((t) => t.caseId === c.id)} hideCase />
          </Card>
        )}
        {tab === 'timeline' && <TimelineTab caseId={c.id} />}
      </div>

      {modal === 'assign' && <AssignPicModal caseId={c.id} onClose={() => setModal(null)} />}
      {modal === 'escalate' && <EscalateModal caseId={c.id} onClose={() => setModal(null)} onDone={() => { setModal(null); setTab('escalation'); }} />}
      {modal === 'task' && <CreateTaskModal caseId={c.id} onClose={() => setModal(null)} onDone={() => { setModal(null); setTab('tasks'); }} />}
      {modal === 'status' && <StatusModal caseId={c.id} options={transitions} onClose={() => setModal(null)} />}
    </div>
  );
}

function Overview({ caseId, onTab }: { caseId: string; onTab: (t: Tab) => void }) {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const changePriority = useDemoStore((s) => s.changePriority);
  const L = useLookups();
  const c = data.cases.find((x) => x.id === caseId)!;
  const conv = getConversation(data, c.conversationId);
  const sla = computeSla(c, now);
  const canEdit = canWorkOnCase(data, me, c, 'case.update') && isCaseOpen(c.status);
  const recent = caseTimeline(data, c.id).slice(-5).reverse();

  return (
    <div className="grid-overview">
      <Card title={<><Lock size={14} aria-hidden="true" /> ต้นทาง (แก้ไขไม่ได้)</>} className="locked-card">
        <KeyValue
          items={[
            ['LINE OA ต้นทาง', <ChannelBadge key="c" channelId={c.originalChannelId} />],
            ['ลูกค้า', <span key="u">{L.customer(c.originalCustomerId)?.displayName} <span className="mono muted small">{L.customer(c.originalCustomerId)?.lineUserId}</span></span>],
            ['บทสนทนา', <button key="v" type="button" className="link-btn" onClick={() => onTab('conversation')}>เปิดบทสนทนา ({conv?.messages.length ?? 0} ข้อความ)</button>],
          ]}
        />
        <p className="muted small">ต้นทางคัดลอกจากบทสนทนาตอนสร้าง Case การ Escalate หรือเปลี่ยน PIC ไม่เปลี่ยนช่องทางลูกค้า</p>
      </Card>

      <Card title="รายละเอียด Case">
        <KeyValue
          items={[
            ['หัวข้อ', c.title],
            ['ประเภท', c.category],
            [
              'ความสำคัญ',
              canEdit ? (
                <select key="p" aria-label="เปลี่ยนความสำคัญ" value={c.priority} onChange={(e) => report(changePriority(c.id, e.target.value as Priority), 'เปลี่ยนความสำคัญแล้ว')}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]} ({p})</option>)}
                </select>
              ) : (
                <PriorityChip key="p" priority={c.priority} />
              ),
            ],
            ['ทักษะที่ต้องใช้', <span key="s" className="tags">{c.requiredSkills.map((s) => <Chip key={s} tone="gray">{s}</Chip>)}</span>],
            ['สร้างเมื่อ', formatDateTime(c.createdAt)],
            ['รายละเอียด', c.description ?? <span className="muted">—</span>],
          ]}
        />
      </Card>

      <Card title="ผู้รับผิดชอบปัจจุบัน">
        <KeyValue
          items={[
            ['แผนก', L.depName(c.currentDepartmentId)],
            ['ทีม', L.teamName(c.currentTeamId)],
            ['PIC', c.currentOwnerId ? <span key="o" className="inline"><Avatar name={L.userName(c.currentOwnerId)} size={22} /> {L.userName(c.currentOwnerId)}</span> : <span className="muted">ยังไม่มอบหมาย</span>],
          ]}
        />
      </Card>

      <Card title={<>SLA <DemoTag>SIMULATED</DemoTag></>}>
        <div className="sla-box">
          <SlaChip state={sla.state} />
          <p className="sla-big">
            {sla.state === 'PAUSED' ? `หยุดนับ — เหลือ ${formatDuration(sla.remainingMs)}` : sla.final ? (sla.remainingMs >= 0 ? 'ปิดทันกำหนด' : `ปิดช้า ${formatDuration(sla.remainingMs)}`) : sla.remainingMs >= 0 ? `เหลือ ${formatDuration(sla.remainingMs)}` : `เกินกำหนด ${formatDuration(sla.remainingMs)}`}
          </p>
          <p className="muted small">กำหนด {formatDateTime(c.dueAt)}{c.slaPausedAt && ` · หยุดนับตั้งแต่ ${formatDateTime(c.slaPausedAt)}`}</p>
        </div>
      </Card>

      <Card title="ไฟล์แนบ">
        <ul className="attach">
          <li><FileText size={14} aria-hidden="true" /> ใบแจ้งความ.pdf <span className="muted small">ตัวอย่าง</span></li>
          <li><FileText size={14} aria-hidden="true" /> รูปความเสียหาย.jpg <span className="muted small">ตัวอย่าง</span></li>
        </ul>
        <p className="muted small"><DemoTag>NOT CONNECTED</DemoTag> เดโม่นี้ไม่รองรับการอัปโหลดหรือดาวน์โหลดไฟล์จริง</p>
      </Card>

      <Card title="ความเคลื่อนไหวล่าสุด" actions={<button type="button" className="link-btn" onClick={() => onTab('timeline')}>ดูทั้งหมด</button>}>
        <ol className="timeline compact">
          {recent.map((t) => (
            <li key={t.id}><span className="tl-dot" aria-hidden="true" /><div><p>{t.label}</p><p className="muted small">{formatDateTime(t.createdAt)}</p></div></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function AssignmentTab({ caseId }: { caseId: string }) {
  const data = useDemoStore((s) => s.data);
  const L = useLookups();
  const hist = assignmentHistory(data, caseId);
  return (
    <Card title="ประวัติการมอบหมาย PIC">
      {hist.length === 0 ? (
        <EmptyState title="ยังไม่เคยมอบหมาย PIC" hint="ใช้ปุ่ม Assign PIC ด้านบน" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>PIC</th><th>ประเภท</th><th>สถานะ</th><th>มอบหมายเมื่อ</th><th>โดย</th><th>คะแนนแนะนำ</th><th>เหตุผล</th></tr></thead>
            <tbody>
              {hist.map((a) => (
                <tr key={a.id}>
                  <td><span className="inline"><Avatar name={L.userName(a.userId)} size={22} /> {L.userName(a.userId)}</span></td>
                  <td>{a.assignmentType}</td>
                  <td>{a.isActive ? <Chip tone="green">ปัจจุบัน</Chip> : <Chip tone="gray">สิ้นสุด {a.unassignedAt ? formatDateTime(a.unassignedAt) : ''}</Chip>}</td>
                  <td className="nowrap">{formatDateTime(a.assignedAt)}</td>
                  <td>{a.assignedBy ? L.userName(a.assignedBy) : <span className="muted">seed</span>}</td>
                  <td>{a.recommendationScore != null ? `${a.recommendationScore}` : '—'}</td>
                  <td>{a.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">หนึ่ง Case มี PRIMARY_PIC ที่ active ได้คนเดียว ประวัติเดิมเก็บไว้ทั้งหมด</p>
    </Card>
  );
}

function TimelineTab({ caseId }: { caseId: string }) {
  const data = useDemoStore((s) => s.data);
  const L = useLookups();
  const events = caseTimeline(data, caseId);
  return (
    <Card title="Timeline">
      <ol className="timeline">
        {events.map((t) => (
          <li key={t.id}>
            <span className="tl-dot" aria-hidden="true" />
            <div>
              <p>{t.label}</p>
              <p className="muted small">{formatDateTime(t.createdAt)} · {t.type}{t.actorId ? ` · โดย ${L.userName(t.actorId)}` : ''}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function StatusModal({ caseId, options, onClose }: { caseId: string; options: CaseStatus[]; onClose: () => void }) {
  const transition = useDemoStore((s) => s.transitionCase);
  const c = useDemoStore((s) => s.data.cases.find((x) => x.id === caseId))!;
  const [next, setNext] = useState<CaseStatus | ''>(options[0] ?? '');
  const [confirm, setConfirm] = useState(false);
  const apply = () => {
    if (!next) return;
    if (report(transition(caseId, next), `เปลี่ยนสถานะเป็น ${CASE_STATUS_LABEL[next]} แล้ว`)) onClose();
  };
  if (confirm) {
    return (
      <ConfirmDialog
        title="ปิด Case?"
        message={`ปิด ${c.caseNumber} แล้วจะแก้ไขต่อไม่ได้จนกว่าจะเปิดใหม่ (REOPENED)`}
        confirmLabel="ปิด Case"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={apply}
      />
    );
  }
  return (
    <Modal
      title="เปลี่ยนสถานะ Case"
      onClose={onClose}
      width={420}
      footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" disabled={!next} onClick={() => (next === 'CLOSED' ? setConfirm(true) : apply())}>บันทึก</Button></>}
    >
      <p>สถานะปัจจุบัน: <CaseStatusChip status={c.status} /></p>
      <fieldset className="radio-list">
        <legend>เลือกสถานะถัดไป (แสดงเฉพาะที่ทำได้)</legend>
        {options.map((s) => (
          <label key={s} className="radio">
            <input type="radio" name="next-status" value={s} checked={next === s} onChange={() => setNext(s)} />
            <CaseStatusChip status={s} /> <span className="muted small">{s}</span>
            {s === 'PENDING' && <span className="muted small">— หยุดนับ SLA</span>}
            {s === 'REOPENED' && <span className="muted small">— เริ่มนับ SLA ใหม่</span>}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
