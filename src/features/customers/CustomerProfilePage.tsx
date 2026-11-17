import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, Lock, Pin, PinOff, UserCog } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { customer360, customerNotesOf, linksOf, ownerHistoryOf, policiesOf } from '../../services/mock/queries';
import {
  canAddCustomerNote,
  canAssignCustomerOwner,
  canEditCustomer,
  canEditField,
  canRequestLink,
  canSeeCase,
  canSeeConversation,
  canSeeCustomer,
} from '../../utils/permissions';
import { CATEGORY_LABEL, PURPOSE_LABEL, canBeLinked, consentOf, noticeOf, optionalPurposes } from '../../utils/consent';
import { POLICY_STATUS_LABEL, POLICY_TONE } from '../../utils/labels';
import { isCaseOpen } from '../../utils/transitions';
import { formatDateTime, ms } from '../../utils/time';
import { DATA_CATEGORIES, type ConsentPurpose, type Customer, type CustomFieldDefinition, type CustomFieldValue } from '../../types/domain';
import { Avatar, Button, Card, EmptyState, Field, KeyValue, Restricted } from '../../components/common/ui';
import { CaseStatusChip, Chip, DemoTag } from '../../components/common/Chip';
import { ConfirmDialog, Modal } from '../../components/overlays/Modal';
import { ChannelBadge } from '../channels/ChannelBadge';
import { ConsentBadge, CustomerLink, OwnerAssignModal, PiiValue, nearestExpiryDays } from './shared';
import { LinksTable } from './LinksTable';

const TABS = [
  ['overview', 'ภาพรวม'],
  ['c360', 'Customer 360'],
  ['consent', 'Consent'],
  ['policies', 'กรมธรรม์'],
  ['history', 'บทสนทนาและ Case'],
  ['notes', 'บันทึกภายใน'],
  ['owners', 'ประวัติผู้ดูแลหลัก'],
] as const;
type Tab = (typeof TABS)[number][0];

export function CustomerProfilePage() {
  const { customerId } = useParams();
  const [params, setParams] = useSearchParams();
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const c = data.customers.find((x) => x.id === customerId);
  if (!c) return <EmptyState title="ไม่พบลูกค้ารายนี้" hint="ข้อมูลอาจถูก Reset แล้ว" action={<Link className="btn btn-primary btn-md" to="/customers">กลับไปรายชื่อลูกค้า</Link>} />;
  if (!canSeeCustomer(data, me, c)) return <Restricted message={`${c.displayName} อยู่นอกขอบเขตของบทบาทเดโม่ปัจจุบัน`} />;

  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'overview') as Tab;
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const days = nearestExpiryDays(data.policies, c.id, now);
  const linked = customer360(data, c.id).length;
  const count = (t: Tab) => (t === 'c360' ? linked : t === 'notes' ? data.customerNotes.filter((n) => n.customerId === c.id).length : t === 'policies' ? data.policies.filter((p) => p.customerId === c.id).length : 0);

  return (
    <div className="workspace">
      <div className="ws-head">
        <Link to="/customers" className="icon-btn" aria-label="กลับไปรายชื่อลูกค้า"><ArrowLeft size={18} /></Link>
        <Avatar name={c.displayName} size={40} />
        <div className="ws-title">
          <div className="ws-title-row">
            <h2>{c.displayName}</h2>
            <ChannelBadge channelId={c.channelId} />
            <ConsentBadge customerId={c.id} />
            {c.customFields?.vip === true && <Chip tone="purple">VIP</Chip>}
            {days !== null && days <= 30 && <Chip tone="amber">กรมธรรม์หมดใน {days} วัน</Chip>}
          </div>
          <p className="ws-sub"><span className="mono">{c.lineUserId}</span> <DemoTag>MOCK</DemoTag> · ตัวตนผูกกับ {data.channels.find((x) => x.id === c.channelId)?.name} เท่านั้น</p>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="ส่วนของโปรไฟล์ลูกค้า">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {label}{count(k) ? <span className="count">{count(k)}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab customer={c} />}
        {tab === 'c360' && <C360Tab customer={c} />}
        {tab === 'consent' && <ConsentTab customer={c} />}
        {tab === 'policies' && <PoliciesTab customer={c} />}
        {tab === 'history' && <HistoryTab customer={c} />}
        {tab === 'notes' && <NotesTab customer={c} />}
        {tab === 'owners' && <OwnersTab customer={c} />}
      </div>
    </div>
  );
}

// ---- Overview -----------------------------------------------------------------------------

function OverviewTab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const L = useLookups();
  const [ownerOpen, setOwnerOpen] = useState(false);
  const pinned = customerNotesOf(data, c.id).filter((n) => n.pinned);
  return (
    <div className="grid-overview">
      <Card title={<><Lock size={14} aria-hidden="true" /> ข้อมูลจาก LINE (แก้ไขไม่ได้)</>} className="locked-card">
        <KeyValue
          items={[
            ['ชื่อที่แสดง', c.displayName],
            ['LINE User ID', <span key="l" className="mono">{c.lineUserId}</span>],
            ['LINE OA', <ChannelBadge key="c" channelId={c.channelId} />],
            ['โทรศัพท์', <PiiValue key="p" customer={c} field="phone" value={c.phone} kind="phone" />],
          ]}
        />
        <p className="muted small">ข้อมูลส่วนบุคคลแสดงแบบปิดบัง การกด “แสดง” ถูกบันทึกใน Audit log</p>
      </Card>

      <Card
        title={<><UserCog size={15} aria-hidden="true" /> ผู้ดูแลหลัก</>}
        actions={canAssignCustomerOwner(data, me, c) && <Button size="sm" onClick={() => setOwnerOpen(true)}>{c.ownerUserId ? 'เปลี่ยน' : 'มอบหมาย'}</Button>}
      >
        {c.ownerUserId ? (
          <div className="inline"><Avatar name={L.userName(c.ownerUserId)} size={28} /> <strong>{L.userName(c.ownerUserId)}</strong> <span className="muted small">{L.teamName(L.user(c.ownerUserId)?.teamId)}</span></div>
        ) : (
          <p className="muted">ยังไม่มีผู้ดูแลหลัก</p>
        )}
        <p className="muted small">ผู้ดูแลหลักดูแลความสัมพันธ์ระยะยาวข้ามทุก Case — ต่างจาก PIC ที่รับผิดชอบทีละ Case</p>
        {pinned.length > 0 && (
          <div className="pinned">
            {pinned.map((n) => <p key={n.id} className="small"><Pin size={12} aria-hidden="true" /> {n.body}</p>)}
          </div>
        )}
      </Card>

      <TagsCard customer={c} />
      <CustomFieldsCard customer={c} />
      {ownerOpen && <OwnerAssignModal customerId={c.id} onClose={() => setOwnerOpen(false)} />}
    </div>
  );
}

function TagsCard({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const update = useDemoStore((s) => s.updateCustomer);
  const me = useActingUser();
  const [input, setInput] = useState('');
  const editable = canEditCustomer(data, me, c);
  const add = () => {
    const t = input.trim();
    if (!t) return;
    if (report(update(c.id, { tags: [...c.tags, t] }), `เพิ่มแท็ก “${t}”`)) setInput('');
  };
  return (
    <Card title="แท็ก">
      <div className="tags">
        {c.tags.length === 0 && <span className="muted small">ยังไม่มีแท็ก</span>}
        {c.tags.map((t) => (
          <span key={t} className="chip chip-gray">
            {t}
            {editable && <button type="button" className="chip-x" aria-label={`ลบแท็ก ${t}`} onClick={() => report(update(c.id, { tags: c.tags.filter((x) => x !== t) }), `ลบแท็ก “${t}”`)}>×</button>}
          </span>
        ))}
      </div>
      {editable && (
        <form className="inline" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label htmlFor="tag-input" className="sr-only">แท็กใหม่</label>
          <input id="tag-input" placeholder="แท็กใหม่" value={input} onChange={(e) => setInput(e.target.value)} maxLength={30} />
          <Button size="sm" type="submit">เพิ่ม</Button>
        </form>
      )}
    </Card>
  );
}

function fieldDisplay(def: CustomFieldDefinition, v: CustomFieldValue): string {
  if (v === null || v === undefined || v === '') return '—';
  if (def.type === 'BOOLEAN') return v ? 'ใช่' : 'ไม่ใช่';
  return String(v);
}

function CustomFieldsCard({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const update = useDemoStore((s) => s.updateCustomer);
  const me = useActingUser();
  const defs = data.customFieldDefs.filter((f) => f.active && (f.channelIds === 'ALL' || f.channelIds.includes(c.channelId)));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, CustomFieldValue>>({});
  const [error, setError] = useState<string | null>(null);
  const canEdit = canEditCustomer(data, me, c);
  const editableDefs = defs.filter((d) => canEditField(me, d));

  const start = () => {
    setDraft(Object.fromEntries(editableDefs.map((d) => [d.key, c.customFields?.[d.key] ?? null])));
    setError(null);
    setEditing(true);
  };
  const save = () => {
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => (c.customFields?.[k] ?? null) !== v));
    if (!Object.keys(changed).length) { setEditing(false); return; }
    const r = update(c.id, { customFields: changed });
    if (r.ok) { report(r, 'บันทึกข้อมูลลูกค้าแล้ว'); setEditing(false); } else setError(r.error);
  };

  return (
    <Card
      title="ข้อมูลเพิ่มเติม (Custom fields)"
      actions={canEdit && editableDefs.length > 0 && !editing && <Button size="sm" onClick={start}>แก้ไข</Button>}
    >
      {defs.length === 0 && <p className="muted small">ยังไม่มีฟิลด์ที่ใช้กับ OA นี้</p>}
      {!editing ? (
        <KeyValue
          items={defs.map((d) => [
            <span key="l">{d.label}{d.isPII && <> <DemoTag>PII</DemoTag></>}</span>,
            d.isPII ? <PiiValue key="v" customer={c} field={d.key} value={c.customFields?.[d.key]} /> : fieldDisplay(d, c.customFields?.[d.key] ?? null),
          ])}
        />
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          {defs.map((d) => {
            const id = `cf-${d.key}`;
            const v = draft[d.key];
            const locked = !canEditField(me, d);
            if (locked) {
              return <p key={d.key} className="small muted">{d.label}: {d.isPII ? 'ปิดบัง' : fieldDisplay(d, c.customFields?.[d.key] ?? null)} — บทบาทนี้แก้ไม่ได้</p>;
            }
            const setV = (x: CustomFieldValue) => { setDraft((p) => ({ ...p, [d.key]: x })); setError(null); };
            return (
              <Field key={d.key} label={d.label} htmlFor={id} required={d.required}>
                {d.type === 'SELECT' ? (
                  <select id={id} value={(v as string) ?? ''} onChange={(e) => setV(e.target.value || null)}>
                    <option value="">—</option>
                    {d.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : d.type === 'BOOLEAN' ? (
                  <select id={id} value={v === true ? 'true' : v === false ? 'false' : ''} onChange={(e) => setV(e.target.value === '' ? null : e.target.value === 'true')}>
                    <option value="">—</option>
                    <option value="true">ใช่</option>
                    <option value="false">ไม่ใช่</option>
                  </select>
                ) : (
                  <input id={id} type={d.type === 'DATE' ? 'date' : d.type === 'NUMBER' ? 'number' : 'text'} value={(v as string | number | null) ?? ''} onChange={(e) => setV(e.target.value === '' ? null : d.type === 'NUMBER' ? Number(e.target.value) : e.target.value)} />
                )}
              </Field>
            );
          })}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="btn-row">
            <Button size="sm" variant="primary" type="submit">บันทึก</Button>
            <Button size="sm" onClick={() => setEditing(false)}>ยกเลิก</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

// ---- Customer 360 --------------------------------------------------------------------------

function C360Tab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const L = useLookups();
  const [requesting, setRequesting] = useState(false);
  const views = customer360(data, c.id);
  const links = linksOf(data, c.id);
  const linkable = canBeLinked(data, c.id);

  return (
    <div className="stack">
      <div className="banner info">
        <Lock size={14} aria-hidden="true" />
        <span>Customer 360 แสดงโปรไฟล์ที่เชื่อมแล้วเท่านั้น และแต่ละโปรไฟล์แสดงเฉพาะหมวดข้อมูลที่อยู่ใน consent ของ OA นั้น — โปรไฟล์ไม่ถูกรวมเป็น record เดียว</span>
      </div>
      <Card
        title={`โปรไฟล์ที่เชื่อมแล้ว (${views.length})`}
        actions={
          canRequestLink(data, me, c) && (
            <Button size="sm" variant="primary" icon={<Link2 size={14} />} disabled={!linkable} title={linkable ? undefined : 'ลูกค้ายังไม่ยินยอมให้เชื่อมข้อมูลข้าม OA'} onClick={() => setRequesting(true)}>
              ขอเชื่อมโปรไฟล์
            </Button>
          )
        }
      >
        {!linkable && <p className="muted small">ลูกค้ารายนี้ยังไม่ยินยอม “{PURPOSE_LABEL.CROSS_SERVICE_LINKING}” จึงเชื่อมโปรไฟล์ไม่ได้</p>}
        {views.length === 0 ? (
          <EmptyState title="ยังไม่มีโปรไฟล์ที่เชื่อม" hint="การเชื่อมต้องมี consent ทั้งสองฝั่งและได้รับอนุมัติจาก Manager" />
        ) : (
          <div className="c360-grid">
            {views.map((v) => {
              const conv = data.conversations.filter((x) => x.customerId === v.customer.id);
              const cases = data.cases.filter((k) => k.originalCustomerId === v.customer.id);
              const pols = policiesOf(data, v.customer.id);
              const show = (cat: (typeof DATA_CATEGORIES)[number]) => v.allowed.includes(cat);
              const blocked = DATA_CATEGORIES.filter((cat) => !v.allowed.includes(cat));
              return (
                <article key={v.customer.id} className="c360-card">
                  <header className="esc-head">
                    <span className="inline"><Avatar name={v.customer.displayName} size={28} /> <strong>{show('IDENTITY') ? v.customer.displayName : 'ปิดบัง'}</strong></span>
                    <ChannelBadge channelId={v.customer.channelId} small />
                  </header>
                  <KeyValue
                    items={[
                      ['LINE User ID', show('IDENTITY') ? <span key="i" className="mono">{v.customer.lineUserId}</span> : <OutOfScope key="i" />],
                      ['โทรศัพท์', show('CONTACT') ? <PiiValue key="p" customer={v.customer} field="phone" value={v.customer.phone} kind="phone" /> : <OutOfScope key="p" />],
                      ['ผู้ดูแลหลัก', L.userName(v.customer.ownerUserId)],
                      ['กรมธรรม์', show('POLICY') ? (pols.length ? pols.map((p) => `${p.product} (${POLICY_STATUS_LABEL[p.status]})`).join(', ') : 'ไม่มี') : <OutOfScope key="po" />],
                      ['Case / เคลม', show('CLAIM_DETAIL') || show('CONVERSATION') ? `${cases.length} Case (เปิด ${cases.filter((k) => isCaseOpen(k.status)).length})` : <OutOfScope key="ca" />],
                      ['บทสนทนา', show('CONVERSATION') ? `${conv.length} บทสนทนา${conv[0] ? ` · ล่าสุด ${formatDateTime(conv[0].lastMessageAt)}` : ''}` : <OutOfScope key="cv" />],
                    ]}
                  />
                  <p className="muted small">แสดงตาม consent: {v.allowed.map((x) => CATEGORY_LABEL[x]).join(', ') || 'ไม่มี'}{blocked.length > 0 && ` · นอกขอบเขต: ${blocked.map((x) => CATEGORY_LABEL[x]).join(', ')}`}</p>
                  {canSeeCustomer(data, me, v.customer) ? <CustomerLink customerId={v.customer.id} /> : <span className="muted small">เปิดโปรไฟล์เต็มไม่ได้ (นอกขอบเขตบทบาท)</span>}
                </article>
              );
            })}
          </div>
        )}
      </Card>
      <Card title="ประวัติการเชื่อมโปรไฟล์">
        <LinksTable links={links} emptyHint="ยังไม่เคยขอเชื่อมโปรไฟล์" />
      </Card>
      {requesting && <LinkRequestModal customer={c} onClose={() => setRequesting(false)} />}
    </div>
  );
}

const OutOfScope = () => <span className="muted small"><Lock size={11} aria-hidden="true" /> นอกขอบเขต consent</span>;

function LinkRequestModal({ customer: c, onClose }: { customer: Customer; onClose: () => void }) {
  const data = useDemoStore((s) => s.data);
  const requestLink = useDemoStore((s) => s.requestLink);
  const L = useLookups();
  const [q, setQ] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const candidates = useMemo(
    () =>
      data.customers
        .filter((x) => x.channelId !== c.channelId)
        .filter((x) => !q.trim() || `${x.displayName} ${x.lineUserId}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [data.customers, c.channelId, q],
  );
  const submit = () => {
    const e: Record<string, string> = {};
    if (!target) e.target = 'กรุณาเลือกโปรไฟล์ที่จะเชื่อม';
    if (!reason.trim()) e.reason = 'กรุณาระบุเหตุผลและหลักฐานว่าเป็นบุคคลเดียวกัน';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (report(requestLink(c.id, target, reason), 'ส่งคำขอเชื่อมโปรไฟล์แล้ว — รอ Manager อนุมัติ')) onClose();
  };
  return (
    <Modal title={`ขอเชื่อมโปรไฟล์ — ${c.displayName}`} onClose={onClose} width={640} footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" onClick={submit}>ส่งคำขอ</Button></>}>
      <p className="muted small">เลือกโปรไฟล์ของบุคคลเดียวกันใน LINE OA อื่น รายการแสดงเฉพาะชื่อที่แสดงและ OA เพื่อจำกัดการเห็นข้อมูล โปรไฟล์ที่ยังไม่ยินยอมให้เชื่อมจะเลือกไม่ได้</p>
      <Field label="ค้นหาโปรไฟล์" htmlFor="lk-q">
        <input id="lk-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อหรือ LINE ID" />
      </Field>
      <fieldset className="radio-list pick-list" aria-describedby={errors.target ? 'lk-target-err' : undefined}>
        <legend>โปรไฟล์ใน OA อื่น ({candidates.length})</legend>
        {candidates.map((x) => {
          const ok = canBeLinked(data, x.id);
          return (
            <label key={x.id} className={`radio ${ok ? '' : 'disabled'}`}>
              <input type="radio" name="lk-target" value={x.id} checked={target === x.id} disabled={!ok} onChange={() => { setTarget(x.id); setErrors((p) => ({ ...p, target: '' })); }} />
              <span>{x.displayName}</span> <ChannelBadge channelId={x.channelId} small />
              <span className="muted small">{ok ? 'ยินยอมเชื่อมข้อมูล' : 'ยังไม่ยินยอม — เลือกไม่ได้'}</span>
            </label>
          );
        })}
      </fieldset>
      {errors.target && <p id="lk-target-err" className="field-error" role="alert">{errors.target}</p>}
      <Field label="เหตุผลและหลักฐาน" htmlFor="lk-reason" required error={errors.reason} hint={`จะส่งให้ Manager ของ ${L.depName(L.channel(c.channelId)?.departmentId)} หรือแผนกเจ้าของ OA ปลายทางพิจารณา`}>
        <textarea id="lk-reason" rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: '' })); }} maxLength={500} />
      </Field>
    </Modal>
  );
}

// ---- Consent --------------------------------------------------------------------------------

function ConsentTab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const simulate = useDemoStore((s) => s.simulateConsent);
  const me = useActingUser();
  const rec = consentOf(data, c.id);
  const notice = noticeOf(data, rec);
  const [pending, setPending] = useState<{ purpose: ConsentPurpose; grant: boolean } | null>(null);
  if (!rec || !notice) return <EmptyState title="ไม่มีบันทึกความยินยอม" />;
  const optional = optionalPurposes(notice);
  const canSimulate = me.role !== 'AUDITOR';
  const affected = data.profileLinks.filter((l) => (l.customerAId === c.id || l.customerBId === c.id) && (l.status === 'APPROVED' || l.status === 'REQUESTED')).length;

  return (
    <div className="grid-2 gap">
      <Card title={<>{notice.title} <Chip tone="gray">v{notice.version}</Chip></>}>
        <p className="consent-body">{notice.body}</p>
        <h3 className="side-sub">วัตถุประสงค์</h3>
        <ul className="purpose-list">
          {notice.purposes.map((p) => {
            const granted = rec.grantedPurposes.includes(p.purpose);
            return (
              <li key={p.purpose}>
                <Chip tone={granted ? 'green' : 'gray'}>{granted ? 'ยินยอม' : 'ไม่ยินยอม'}</Chip>
                <span>{PURPOSE_LABEL[p.purpose]}</span>
                <span className="muted small">{p.required ? '(จำเป็นต่อการให้บริการ)' : '(ลูกค้าเลือกได้)'}</span>
              </li>
            );
          })}
        </ul>
        <h3 className="side-sub">หมวดข้อมูลที่เก็บภายใต้ consent นี้</h3>
        <div className="tags">{notice.dataCategories.map((x) => <Chip key={x} tone="blue">{CATEGORY_LABEL[x]}</Chip>)}</div>
        <p className="muted small">ระยะเวลาเก็บ: {notice.retentionText}</p>
        <p className="muted small"><DemoTag>ตัวอย่าง</DemoTag> ข้อความนี้ไม่ใช่ข้อความทางกฎหมาย ต้องให้ Legal / DPO กำหนดก่อนใช้จริง</p>
      </Card>

      <div className="stack">
        <Card title="สถานะและหลักฐาน">
          <KeyValue
            items={[
              ['ยอมรับเมื่อ', formatDateTime(rec.grantedAt)],
              ['หลักฐาน', rec.evidenceConversationId ? <Link key="e" className="link" to={`/inbox/${rec.evidenceConversationId}`}>ลูกค้ากดยอมรับใน LINE (SIMULATED)</Link> : 'ลูกค้ากดยอมรับตอนเพิ่มเพื่อน OA (SIMULATED)'],
              ['เวอร์ชัน', `v${rec.noticeVersion}`],
            ]}
          />
        </Card>
        <Card title={<>จำลองการกระทำของลูกค้า <DemoTag>SIMULATED</DemoTag></>}>
          <p className="muted small">ในระบบจริง ลูกค้าเป็นผู้ให้หรือถอนความยินยอมผ่าน LINE เท่านั้น พนักงานแก้แทนลูกค้าไม่ได้ ปุ่มด้านล่างใช้สาธิตผลที่เกิดขึ้นในระบบ</p>
          {canSimulate ? (
            <div className="btn-col">
              {optional.map((p) => {
                const granted = rec.grantedPurposes.includes(p);
                return (
                  <Button key={p} size="sm" variant={granted ? 'danger' : 'secondary'} onClick={() => setPending({ purpose: p, grant: !granted })}>
                    จำลอง: ลูกค้า{granted ? 'ถอน' : 'ให้'}ความยินยอม “{PURPOSE_LABEL[p]}”
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="muted small">บทบาท Auditor ใช้ตัวจำลองนี้ไม่ได้</p>
          )}
        </Card>
        <Card title="ประวัติความยินยอม">
          <ol className="timeline compact">
            {[...rec.history].reverse().map((h, i) => (
              <li key={i}>
                <span className="tl-dot" aria-hidden="true" />
                <div>
                  <p>{h.action === 'GRANTED' ? 'ให้ความยินยอม' : 'ถอนความยินยอม'}: {h.purposes.map((p) => PURPOSE_LABEL[p]).join(', ')}</p>
                  <p className="muted small">{formatDateTime(h.at)} · ลูกค้าดำเนินการเอง (SIMULATED)</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.grant ? 'จำลอง: ลูกค้าให้ความยินยอม' : 'จำลอง: ลูกค้าถอนความยินยอม'}
          message={
            <>
              <p>วัตถุประสงค์: {PURPOSE_LABEL[pending.purpose]}</p>
              {!pending.grant && pending.purpose === 'CROSS_SERVICE_LINKING' && affected > 0 && (
                <p className="field-error">การเชื่อมโปรไฟล์ที่เกี่ยวข้อง {affected} รายการจะถูกระงับ / ปฏิเสธอัตโนมัติ</p>
              )}
              {pending.grant && pending.purpose === 'CROSS_SERVICE_LINKING' && <p className="muted small">การเชื่อมที่เคยถูกระงับจะไม่กลับมาเอง ต้องขออนุมัติใหม่</p>}
            </>
          }
          confirmLabel="จำลอง"
          danger={!pending.grant}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (report(simulate(c.id, pending.purpose, pending.grant), pending.grant ? 'บันทึกการให้ความยินยอม (SIMULATED)' : 'บันทึกการถอนความยินยอม (SIMULATED)')) setPending(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Policies / history / notes / owners -------------------------------------------------------

function PoliciesTab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const pols = policiesOf(data, c.id);
  return (
    <Card title={<>กรมธรรม์ <DemoTag>MOCK</DemoTag></>}>
      {pols.length === 0 ? (
        <EmptyState title="ไม่มีกรมธรรม์" hint="อาจเป็นผู้สนใจที่ยังไม่ได้ซื้อ" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>เลขกรมธรรม์</th><th>ผลิตภัณฑ์</th><th>สถานะ</th><th>เริ่มคุ้มครอง</th><th>หมดอายุ</th></tr></thead>
            <tbody>
              {pols.map((p) => {
                const days = Math.ceil((ms(p.expiryDate) - ms(now)) / 86_400_000);
                return (
                  <tr key={p.id}>
                    <td className="mono">{p.policyNo}</td>
                    <td>{p.product}</td>
                    <td><Chip tone={POLICY_TONE[p.status]}>{POLICY_STATUS_LABEL[p.status]}</Chip></td>
                    <td className="nowrap">{formatDateTime(p.effectiveDate).split(' ').slice(0, 2).join(' ')}</td>
                    <td className="nowrap">{formatDateTime(p.expiryDate).split(' ').slice(0, 2).join(' ')} {p.status === 'ACTIVE' && days >= 0 && days <= 30 && <Chip tone="amber">อีก {days} วัน</Chip>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">เลขกรมธรรม์และวันที่ทั้งหมดเป็นข้อมูลสมมติ</p>
    </Card>
  );
}

function HistoryTab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const L = useLookups();
  const convs = data.conversations.filter((x) => x.customerId === c.id);
  const cases = data.cases.filter((k) => k.originalCustomerId === c.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <div className="grid-2 gap">
      <Card title={`บทสนทนา (${convs.length})`}>
        {convs.length === 0 ? <p className="muted">ยังไม่เคยทักเข้ามา</p> : (
          <ul className="related">
            {convs.map((v) => (
              <li key={v.id}>
                {canSeeConversation(data, me, v) ? (
                  <Link to={`/inbox/${v.id}`} className="related-item"><ChannelBadge channelId={v.channelId} small /> ล่าสุด {formatDateTime(v.lastMessageAt)} · PIC {L.userName(v.assignedUserId)}</Link>
                ) : <span className="related-item muted"><Lock size={12} /> บทสนทนานอกขอบเขตสิทธิ์</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Case (${cases.length})`}>
        {cases.length === 0 ? <p className="muted">ยังไม่มี Case</p> : (
          <ul className="related">
            {cases.map((k) => (
              <li key={k.id}>
                {canSeeCase(data, me, k) ? (
                  <Link to={`/cases/${k.id}`} className="related-item"><span className="mono">{k.caseNumber}</span> <CaseStatusChip status={k.status} /> <span className="related-title">{k.title}</span></Link>
                ) : <span className="related-item muted"><Lock size={12} /> {k.caseNumber} (นอกขอบเขตสิทธิ์)</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NotesTab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const add = useDemoStore((s) => s.addCustomerNote);
  const togglePin = useDemoStore((s) => s.toggleNotePin);
  const me = useActingUser();
  const L = useLookups();
  const [body, setBody] = useState('');
  const [pin, setPin] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const notes = customerNotesOf(data, c.id);
  const can = canAddCustomerNote(data, me, c);
  const submit = () => {
    const r = add(c.id, body, pin);
    if (r.ok) { report(r, 'บันทึกภายในแล้ว'); setBody(''); setPin(false); setErr(null); } else setErr(r.error);
  };
  return (
    <Card title={<>บันทึกภายใน <DemoTag>INTERNAL ONLY</DemoTag></>}>
      <p className="muted small">ลูกค้าไม่เห็นบันทึกนี้ และไม่ถูกส่งไป LINE</p>
      <ul className="comments">
        {notes.length === 0 && <li className="muted small">ยังไม่มีบันทึก</li>}
        {notes.map((n) => (
          <li key={n.id} className="comment">
            <Avatar name={L.userName(n.authorId)} size={24} />
            <div>
              <p className="small"><strong>{L.userName(n.authorId)}</strong> <span className="muted">{formatDateTime(n.createdAt)}</span> {n.pinned && <Chip tone="amber"><Pin size={10} aria-hidden="true" /> ปักหมุด</Chip>}</p>
              <p>{n.body}</p>
              {can && (
                <button type="button" className="link-btn small" onClick={() => report(togglePin(n.id))}>
                  {n.pinned ? <><PinOff size={12} aria-hidden="true" /> เลิกปักหมุด</> : <><Pin size={12} aria-hidden="true" /> ปักหมุด</>}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {can ? (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="เพิ่มบันทึก" htmlFor="cn-body" error={err}>
            <textarea id="cn-body" rows={2} value={body} onChange={(e) => { setBody(e.target.value); setErr(null); }} />
          </Field>
          <div className="inline">
            <label className="check"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> ปักหมุด (แสดงในหน้าภาพรวม)</label>
            <Button size="sm" variant="primary" type="submit">บันทึก</Button>
          </div>
        </form>
      ) : <p className="muted small">บทบาทนี้เพิ่มบันทึกไม่ได้</p>}
    </Card>
  );
}

function OwnersTab({ customer: c }: { customer: Customer }) {
  const data = useDemoStore((s) => s.data);
  const L = useLookups();
  const hist = ownerHistoryOf(data, c.id);
  return (
    <Card title="ประวัติผู้ดูแลหลัก">
      {hist.length === 0 ? <EmptyState title="ยังไม่เคยมีผู้ดูแลหลัก" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ผู้ดูแลหลัก</th><th>สถานะ</th><th>เริ่ม</th><th>สิ้นสุด</th><th>มอบหมายโดย</th><th>เหตุผล</th></tr></thead>
            <tbody>
              {hist.map((a) => (
                <tr key={a.id}>
                  <td>{L.userName(a.userId)}</td>
                  <td>{a.isActive ? <Chip tone="green">ปัจจุบัน</Chip> : <Chip tone="gray">สิ้นสุด</Chip>}</td>
                  <td className="nowrap">{formatDateTime(a.assignedAt)}</td>
                  <td className="nowrap">{a.endedAt ? formatDateTime(a.endedAt) : '—'}</td>
                  <td>{a.assignedBy ? L.userName(a.assignedBy) : <span className="muted">seed</span>}</td>
                  <td>{a.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
