import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Plus, Trash2, X } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { segmentMembers } from '../../services/mock/queries';
import { can } from '../../utils/permissions';
import { PURPOSE_LABEL } from '../../utils/consent';
import { describeRule } from '../../utils/segments';
import { formatDateTime } from '../../utils/time';
import { CONSENT_PURPOSES, type SegmentRule } from '../../types/domain';
import { Button, Card, EmptyState, Field, UserChip } from '../../components/common/ui';
import { DemoTag } from '../../components/common/Chip';
import { ConfirmDialog, Modal } from '../../components/overlays/Modal';
import { ChannelBadge } from '../channels/ChannelBadge';
import { ConsentBadge, nearestExpiryDays } from '../customers/shared';

export function SegmentsPage() {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const del = useDemoStore((s) => s.deleteSegment);
  const me = useActingUser();
  const L = useLookups();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const selectedId = params.get('id') ?? data.segments[0]?.id ?? '';
  const seg = data.segments.find((s) => s.id === selectedId);
  const members = useMemo(() => (seg ? segmentMembers(data, me, seg.id, now) : []), [data, me, seg, now]);
  const counts = useMemo(() => Object.fromEntries(data.segments.map((s) => [s.id, segmentMembers(data, me, s.id, now).length])), [data, me, now]);
  const canManage = can(me, 'segment.manage');
  const canDelete = (ownerDep: string | null) => canManage && (me.role === 'SUPER_ADMIN' || ownerDep === me.departmentId);

  return (
    <div className="stack">
      <div className="banner info"><Filter size={14} aria-hidden="true" /> Segment ใช้ดูและกรองลูกค้าภายในเท่านั้น ไม่มีการส่งข้อความออก <DemoTag>NOT CONNECTED</DemoTag> — สมาชิกคำนวณสดและจำกัดตามขอบเขตของบทบาทที่ดูอยู่</div>
      <div className="seg-layout">
        <Card title={`Segments (${data.segments.length})`} actions={canManage && <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>สร้าง</Button>}>
          <ul className="seg-list">
            {data.segments.map((s) => (
              <li key={s.id}>
                <button type="button" className={`seg-item ${s.id === selectedId ? 'active' : ''}`} aria-current={s.id === selectedId ? 'true' : undefined} onClick={() => setParams({ id: s.id }, { replace: true })}>
                  <strong>{s.name}</strong>
                  <span className="muted small">{counts[s.id]} ลูกค้า · {s.ownerDepartmentId ? L.depName(s.ownerDepartmentId) : 'ทุกแผนก'}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.segments.length === 0 && <p className="muted small">ยังไม่มี Segment</p>}
        </Card>
        {seg ? (
          <Card
            title={`${seg.name} (${members.length})`}
            actions={canDelete(seg.ownerDepartmentId) && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDel(seg.id)}>ลบ</Button>}
          >
            {seg.description && <p>{seg.description}</p>}
            <div className="tags">{seg.rules.map((r, i) => <span key={i} className="chip chip-blue">{describeRule(data, r)}</span>)}</div>
            <p className="muted small">สร้างโดย {L.userName(seg.createdBy)} · {formatDateTime(seg.createdAt)} · เงื่อนไขทุกข้อต้องตรง (AND)</p>
            {members.length === 0 ? <EmptyState title="ไม่มีลูกค้าตรงเงื่อนไขในขอบเขตของบทบาทนี้" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>ลูกค้า</th><th>LINE OA</th><th>ผู้ดูแลหลัก</th><th>กรมธรรม์ใกล้หมด</th><th>Consent</th></tr></thead>
                  <tbody>
                    {members.map((c) => {
                      const days = nearestExpiryDays(data.policies, c.id, now);
                      return (
                        <tr key={c.id}>
                          <td><Link to={`/customers/${c.id}`} className="link">{c.displayName}</Link></td>
                          <td><ChannelBadge channelId={c.channelId} small /></td>
                          <td>{c.ownerUserId ? <UserChip userId={c.ownerUserId} name={L.userName(c.ownerUserId)} /> : '—'}</td>
                          <td>{days !== null ? `อีก ${days} วัน` : '—'}</td>
                          <td><ConsentBadge customerId={c.id} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <Card><EmptyState title="เลือก Segment ทางซ้าย" /></Card>
        )}
      </div>
      {creating && <CreateSegmentModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setParams({ id }, { replace: true }); }} />}
      {confirmDel && (
        <ConfirmDialog
          title="ลบ Segment?"
          message="ลบเฉพาะเงื่อนไขการจัดกลุ่ม ข้อมูลลูกค้าไม่ถูกลบ"
          confirmLabel="ลบ"
          danger
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            if (report(del(confirmDel), 'ลบ Segment แล้ว')) { setConfirmDel(null); setParams({}, { replace: true }); }
          }}
        />
      )}
    </div>
  );
}

type Kind = SegmentRule['kind'];
const KIND_LABEL: Record<Kind, string> = {
  CHANNEL: 'LINE OA',
  TAG: 'แท็ก',
  OWNER: 'ผู้ดูแลหลัก',
  HAS_OPEN_CASE: 'มี Case เปิดอยู่',
  POLICY_EXPIRES_WITHIN: 'กรมธรรม์หมดอายุภายใน (วัน)',
  POLICY_PRODUCT: 'มีกรมธรรม์ผลิตภัณฑ์',
  CONSENT_PURPOSE: 'ยินยอมวัตถุประสงค์',
  CUSTOM_FIELD: 'Custom field',
};

function defaultRule(kind: Kind, data: ReturnType<typeof useDemoStore.getState>['data']): SegmentRule {
  switch (kind) {
    case 'CHANNEL': return { kind, channelId: data.channels[0]!.id };
    case 'TAG': return { kind, tag: '' };
    case 'OWNER': return { kind, ownerUserId: null };
    case 'HAS_OPEN_CASE': return { kind, value: true };
    case 'POLICY_EXPIRES_WITHIN': return { kind, days: 30 };
    case 'POLICY_PRODUCT': return { kind, product: data.policies[0]?.product ?? '' };
    case 'CONSENT_PURPOSE': return { kind, purpose: 'CROSS_SERVICE_LINKING' };
    case 'CUSTOM_FIELD': {
      const f = data.customFieldDefs.find((x) => x.active && !x.isPII)!;
      return { kind, key: f.key, value: f.type === 'BOOLEAN' ? true : (f.options?.[0] ?? '') };
    }
  }
}

function CreateSegmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const create = useDemoStore((s) => s.createSegment);
  const me = useActingUser();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<SegmentRule[]>([{ kind: 'POLICY_EXPIRES_WITHIN', days: 30 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const products = [...new Set(data.policies.map((p) => p.product))];
  const fields = data.customFieldDefs.filter((f) => f.active && !f.isPII);
  const setRule = (i: number, r: SegmentRule) => setRules((xs) => xs.map((x, j) => (j === i ? r : x)));

  // live preview with the same evaluator the service uses
  const preview = useMemo(() => {
    const tmp = { ...data, segments: [...data.segments, { id: '__preview', name, rules, ownerDepartmentId: null, createdBy: me.id, createdAt: now }] };
    return segmentMembers(tmp, me, '__preview', now).length;
  }, [data, rules, me, now, name]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'กรุณาตั้งชื่อ Segment';
    if (!rules.length) e.rules = 'ต้องมีเงื่อนไขอย่างน้อย 1 ข้อ';
    if (rules.some((r) => r.kind === 'TAG' && !r.tag.trim())) e.rules = 'กรุณาระบุแท็ก';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = create({ name, description, rules });
    if (report(r, 'สร้าง Segment แล้ว')) onCreated(r.value);
  };

  return (
    <Modal title="สร้าง Segment" onClose={onClose} width={680} footer={<><span className="muted small grow">ตรงเงื่อนไข {preview} ลูกค้า (ในขอบเขตของคุณ)</span><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" onClick={submit}>สร้าง</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="ชื่อ Segment" htmlFor="sg-name" required error={errors.name}>
          <input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="คำอธิบาย" htmlFor="sg-desc">
          <input id="sg-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        </Field>
        <fieldset className="rules">
          <legend>เงื่อนไข (ทุกข้อต้องตรง)</legend>
          {rules.map((r, i) => (
            <div key={i} className="rule-row">
              <select aria-label={`ชนิดเงื่อนไขที่ ${i + 1}`} value={r.kind} onChange={(e) => setRule(i, defaultRule(e.target.value as Kind, data))}>
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              <RuleValue rule={r} onChange={(x) => setRule(i, x)} products={products} fields={fields} index={i} />
              <button type="button" className="icon-btn" aria-label={`ลบเงื่อนไขที่ ${i + 1}`} onClick={() => setRules((xs) => xs.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setRules((xs) => [...xs, defaultRule('CHANNEL', data)])}>เพิ่มเงื่อนไข</Button>
          {errors.rules && <p className="field-error" role="alert">{errors.rules}</p>}
        </fieldset>
        <p className="muted small">ไม่มีเงื่อนไขจากข้อมูลส่วนบุคคล (PII) เพื่อลดการใช้ข้อมูลเกินจำเป็น</p>
      </form>
    </Modal>
  );
}

function RuleValue({ rule: r, onChange, products, fields, index }: { rule: SegmentRule; onChange: (r: SegmentRule) => void; products: string[]; fields: ReturnType<typeof useDemoStore.getState>['data']['customFieldDefs']; index: number }) {
  const data = useDemoStore((s) => s.data);
  const label = `ค่าของเงื่อนไขที่ ${index + 1}`;
  switch (r.kind) {
    case 'CHANNEL':
      return <select aria-label={label} value={r.channelId} onChange={(e) => onChange({ ...r, channelId: e.target.value })}>{data.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
    case 'TAG':
      return <input aria-label={label} value={r.tag} placeholder="เช่น Motor" onChange={(e) => onChange({ ...r, tag: e.target.value })} />;
    case 'OWNER':
      return (
        <select aria-label={label} value={r.ownerUserId ?? ''} onChange={(e) => onChange({ ...r, ownerUserId: e.target.value || null })}>
          <option value="">ยังไม่มีผู้ดูแลหลัก</option>
          {data.users.filter((u) => ['PIC_AGENT', 'SUPERVISOR', 'MANAGER'].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      );
    case 'HAS_OPEN_CASE':
      return <select aria-label={label} value={r.value ? 'y' : 'n'} onChange={(e) => onChange({ ...r, value: e.target.value === 'y' })}><option value="y">ใช่</option><option value="n">ไม่ใช่</option></select>;
    case 'POLICY_EXPIRES_WITHIN':
      return <input aria-label={label} type="number" min={1} max={365} value={r.days} onChange={(e) => onChange({ ...r, days: Number(e.target.value) })} />;
    case 'POLICY_PRODUCT':
      return <select aria-label={label} value={r.product} onChange={(e) => onChange({ ...r, product: e.target.value })}>{products.map((p) => <option key={p} value={p}>{p}</option>)}</select>;
    case 'CONSENT_PURPOSE':
      return <select aria-label={label} value={r.purpose} onChange={(e) => onChange({ ...r, purpose: e.target.value as typeof r.purpose })}>{CONSENT_PURPOSES.map((p) => <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>)}</select>;
    case 'CUSTOM_FIELD': {
      const f = fields.find((x) => x.key === r.key) ?? fields[0]!;
      return (
        <span className="inline">
          <select aria-label={`ฟิลด์ของเงื่อนไขที่ ${index + 1}`} value={r.key} onChange={(e) => {
            const nf = fields.find((x) => x.key === e.target.value)!;
            onChange({ ...r, key: nf.key, value: nf.type === 'BOOLEAN' ? true : (nf.options?.[0] ?? '') });
          }}>
            {fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          {f.type === 'BOOLEAN' ? (
            <select aria-label={label} value={r.value ? 'y' : 'n'} onChange={(e) => onChange({ ...r, value: e.target.value === 'y' })}><option value="y">ใช่</option><option value="n">ไม่ใช่</option></select>
          ) : f.type === 'SELECT' ? (
            <select aria-label={label} value={String(r.value ?? '')} onChange={(e) => onChange({ ...r, value: e.target.value })}>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          ) : (
            <input aria-label={label} value={String(r.value ?? '')} onChange={(e) => onChange({ ...r, value: e.target.value })} />
          )}
        </span>
      );
    }
  }
}
