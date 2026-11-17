import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ShieldCheck, ShieldOff } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { assignableOwnerIds, canAssignCustomerOwner, canRevealPii } from '../../utils/permissions';
import { consentOf, hasPurpose } from '../../utils/consent';
import { maskPhone, maskValue } from '../../utils/pii';
import { ms } from '../../utils/time';
import type { Customer } from '../../types/domain';
import { Button, Field } from '../../components/common/ui';
import { Chip } from '../../components/common/Chip';
import { Modal } from '../../components/overlays/Modal';

const DAY = 86_400_000;

/** Days until the nearest ACTIVE policy expiry, or null. */
export function nearestExpiryDays(policies: { status: string; expiryDate: string; customerId: string }[], customerId: string, now: string): number | null {
  const days = policies
    .filter((p) => p.customerId === customerId && p.status === 'ACTIVE' && ms(p.expiryDate) >= ms(now))
    .map((p) => Math.ceil((ms(p.expiryDate) - ms(now)) / DAY));
  return days.length ? Math.min(...days) : null;
}

/**
 * Masked PII with an audited "show" action. Revealed state is per component instance and
 * resets when the acting role changes (the key includes the acting user).
 */
export function PiiValue({ customer, field, value, kind = 'generic' }: { customer: Customer; field: string; value: unknown; kind?: 'phone' | 'generic' }) {
  const data = useDemoStore((s) => s.data);
  const actingUserId = useDemoStore((s) => s.actingUserId);
  return <PiiInner key={`${actingUserId}-${customer.id}-${field}`} customer={customer} field={field} value={value} kind={kind} allowed={canRevealPii(data, data.users.find((u) => u.id === actingUserId)!, customer)} />;
}

function PiiInner({ customer, field, value, kind, allowed }: { customer: Customer; field: string; value: unknown; kind: 'phone' | 'generic'; allowed: boolean }) {
  const reveal = useDemoStore((s) => s.revealPii);
  const [shown, setShown] = useState(false);
  if (value === null || value === undefined || value === '') return <span className="muted">—</span>;
  const text = String(value);
  if (shown) return <span className="pii shown">{text}</span>;
  return (
    <span className="pii">
      <span className="mono">{kind === 'phone' ? maskPhone(text) : maskValue(text)}</span>
      {allowed ? (
        <button type="button" className="link-btn small" onClick={() => report(reveal(customer.id, field)) && setShown(true)} title="การเปิดดูจะถูกบันทึกใน Audit log">
          <Eye size={12} aria-hidden="true" /> แสดง
        </button>
      ) : (
        <span className="muted small" title="บทบาทนี้เปิดดูข้อมูลเต็มไม่ได้">(ปิดบัง)</span>
      )}
    </span>
  );
}

export function ConsentBadge({ customerId }: { customerId: string }) {
  const data = useDemoStore((s) => s.data);
  const rec = consentOf(data, customerId);
  if (!rec) return <Chip tone="red">ไม่มี consent</Chip>;
  const linkable = hasPurpose(data, customerId, 'CROSS_SERVICE_LINKING');
  return (
    <Chip tone={linkable ? 'green' : 'gray'} title={`Consent v${rec.noticeVersion} — ${linkable ? 'ยินยอมให้เชื่อมข้อมูลข้าม OA' : 'ไม่ได้ยินยอมให้เชื่อมข้อมูลข้าม OA'}`}>
      {linkable ? <ShieldCheck size={11} aria-hidden="true" /> : <ShieldOff size={11} aria-hidden="true" />} Consent v{rec.noticeVersion}
      {linkable ? ' · เชื่อมได้' : ' · ไม่เชื่อม'}
    </Chip>
  );
}

export function CustomerLink({ customerId, showChannel = true }: { customerId: string; showChannel?: boolean }) {
  const L = useLookups();
  const c = L.customer(customerId);
  if (!c) return <span className="muted">{customerId}</span>;
  return (
    <Link to={`/customers/${c.id}`} className="link">
      {c.displayName}
      {showChannel && <span className="muted small"> · {L.channel(c.channelId)?.name}</span>}
    </Link>
  );
}

export function OwnerAssignModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const data = useDemoStore((s) => s.data);
  const assign = useDemoStore((s) => s.assignCustomerOwner);
  const me = useActingUser();
  const L = useLookups();
  const c = data.customers.find((x) => x.id === customerId)!;
  const allowed = new Set(assignableOwnerIds(data, me, c));
  const byDept = data.departments
    .map((dep) => ({ dep, users: data.users.filter((u) => u.departmentId === dep.id && allowed.has(u.id)) }))
    .filter((g) => g.users.length);
  const [userId, setUserId] = useState<string>(c.ownerUserId ?? '');
  const [reason, setReason] = useState('');
  const ok = canAssignCustomerOwner(data, me, c);
  const submit = () => {
    const target = userId || null;
    if (report(assign(c.id, target, reason), target ? `ผู้ดูแลหลัก: ${L.userName(target)}` : 'ยกเลิกผู้ดูแลหลักแล้ว')) onClose();
  };
  const roleShort = (r: string) => (r === 'PIC_AGENT' ? 'PIC' : r === 'SUPERVISOR' ? 'Supervisor' : 'Manager');
  return (
    <Modal
      title={`ผู้ดูแลหลัก — ${c.displayName}`}
      onClose={onClose}
      width={500}
      footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" disabled={!ok || (userId || null) === (c.ownerUserId ?? null)} onClick={submit}>บันทึก</Button></>}
    >
      <p className="muted small">
        ผู้ดูแลหลักดูแลความสัมพันธ์กับลูกค้าระยะยาวข้ามทุก Case (ต่างจาก PIC ที่รับผิดชอบทีละ Case) เลือกได้จากทุกแผนก
        และไม่บังคับ — ผู้มุ่งหวังที่แค่สอบถามข้อมูลไม่จำเป็นต้องมี เมื่อสร้าง Case ผู้ดูแลหลักจะขึ้นเป็นลำดับแรกถ้าอยู่ในรายชื่อ PIC ของหัวข้อนั้น
      </p>
      <Field label="ผู้ดูแลหลัก" htmlFor="owner-user" hint={allowed.size && byDept.length === 1 && byDept[0]!.dep.id === me.departmentId ? `บทบาทนี้เลือกได้เฉพาะคนในแผนก ${L.depName(me.departmentId)}` : undefined}>
        <select id="owner-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">— ไม่มีผู้ดูแลหลัก —</option>
          {byDept.map(({ dep, users }) => (
            <optgroup key={dep.id} label={dep.name}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {roleShort(u.role)}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="เหตุผล (ไม่บังคับ)" htmlFor="owner-reason">
        <input id="owner-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </Field>
    </Modal>
  );
}
