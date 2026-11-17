import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { visibleCustomers } from '../../services/mock/queries';
import { canDecideLink, canSeeCustomer } from '../../utils/permissions';
import { hasPurpose } from '../../utils/consent';
import { matchesAll } from '../../utils/segments';
import { isCaseOpen } from '../../utils/transitions';
import { Card, EmptyState } from '../../components/common/ui';
import { Chip } from '../../components/common/Chip';
import { ChannelBadge } from '../channels/ChannelBadge';
import { ConsentBadge, nearestExpiryDays } from './shared';
import { LinksTable } from './LinksTable';

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'links' ? 'links' : 'list';
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const pendingForMe = data.profileLinks.filter((l) => l.status === 'REQUESTED' && canDecideLink(data, me, l)).length;
  const setView = (v: 'list' | 'links') => setParams(v === 'list' ? {} : { view: 'links' }, { replace: true });

  return (
    <div className="stack">
      <div className="tabs" role="tablist" aria-label="ลูกค้า">
        <button type="button" role="tab" aria-selected={view === 'list'} className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>รายชื่อลูกค้า</button>
        <button type="button" role="tab" aria-selected={view === 'links'} className={`tab ${view === 'links' ? 'active' : ''}`} onClick={() => setView('links')}>
          คำขอเชื่อมโปรไฟล์{pendingForMe > 0 && <span className="count">{pendingForMe}</span>}
        </button>
      </div>
      {view === 'list' ? <CustomerList /> : <LinkRequests />}
    </div>
  );
}

function CustomerList() {
  const [params, setParams] = useSearchParams();
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const L = useLookups();
  const get = (k: string) => params.get(k) ?? 'ALL';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (!v || v === 'ALL') p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const visible = useMemo(() => visibleCustomers(data, me), [data, me]);
  const owners = data.users.filter((u) => visible.some((c) => c.ownerUserId === u.id));
  const segments = data.segments;

  const rows = useMemo(() => {
    const seg = segments.find((s) => s.id === get('segment'));
    return visible
      .filter((c) => get('channel') === 'ALL' || c.channelId === get('channel'))
      .filter((c) => {
        const o = get('owner');
        if (o === 'ALL') return true;
        if (o === 'NONE') return !c.ownerUserId;
        if (o === 'ME') return c.ownerUserId === me.id;
        return c.ownerUserId === o;
      })
      .filter((c) => get('consent') === 'ALL' || (get('consent') === 'LINK') === hasPurpose(data, c.id, 'CROSS_SERVICE_LINKING'))
      .filter((c) => get('open') === 'ALL' || data.cases.some((k) => k.originalCustomerId === c.id && isCaseOpen(k.status)))
      .filter((c) => get('expiring') === 'ALL' || (nearestExpiryDays(data.policies, c.id, now) ?? 999) <= 30)
      .filter((c) => !seg || matchesAll(data, c, seg.rules, now))
      .filter((c) => !q || `${c.displayName} ${c.lineUserId} ${c.tags.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [visible, params, data, now, me, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title={`ลูกค้า (${rows.length})`}>
      <div className="filters">
        <input aria-label="ค้นหาลูกค้า" placeholder="ค้นหาชื่อ, LINE ID, แท็ก…" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} />
        <select aria-label="LINE OA" value={get('channel')} onChange={(e) => set('channel', e.target.value)}>
          <option value="ALL">ทุก OA</option>
          {data.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="ผู้ดูแลหลัก" value={get('owner')} onChange={(e) => set('owner', e.target.value)}>
          <option value="ALL">ทุกผู้ดูแล</option>
          <option value="ME">ลูกค้าที่ฉันดูแล</option>
          <option value="NONE">ยังไม่มีผู้ดูแลหลัก</option>
          {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select aria-label="Consent" value={get('consent')} onChange={(e) => set('consent', e.target.value)}>
          <option value="ALL">ทุกสถานะ consent</option>
          <option value="LINK">ยินยอมเชื่อมข้อมูล</option>
          <option value="NOLINK">ไม่ยินยอมเชื่อมข้อมูล</option>
        </select>
        <select aria-label="Segment" value={get('segment')} onChange={(e) => set('segment', e.target.value)}>
          <option value="ALL">ทุก Segment</option>
          {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={get('open') !== 'ALL'} onChange={(e) => set('open', e.target.checked ? '1' : 'ALL')} /> มี Case เปิดอยู่</label>
        <label className="check"><input type="checkbox" checked={get('expiring') !== 'ALL'} onChange={(e) => set('expiring', e.target.checked ? '1' : 'ALL')} /> กรมธรรม์หมดใน 30 วัน</label>
        {params.toString() && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>ล้างตัวกรอง</button>}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="ไม่พบลูกค้า" hint={visible.length ? 'ลองเปลี่ยนตัวกรอง' : 'บทบาทนี้ยังไม่มีลูกค้าในขอบเขต'} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ลูกค้า</th><th>LINE OA</th><th>ผู้ดูแลหลัก</th><th>แท็ก</th><th>Case เปิด</th><th>กรมธรรม์</th><th>Consent</th><th>เชื่อมโปรไฟล์</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const open = data.cases.filter((k) => k.originalCustomerId === c.id && isCaseOpen(k.status)).length;
                const days = nearestExpiryDays(data.policies, c.id, now);
                const active = data.policies.filter((p) => p.customerId === c.id && p.status === 'ACTIVE').length;
                const links = data.profileLinks.filter((l) => (l.customerAId === c.id || l.customerBId === c.id) && l.status === 'APPROVED').length;
                return (
                  <tr key={c.id}>
                    <td><Link to={`/customers/${c.id}`} className="link">{c.displayName}</Link><div className="muted small mono">{c.lineUserId}</div></td>
                    <td><ChannelBadge channelId={c.channelId} small /></td>
                    <td>{c.ownerUserId ? L.userName(c.ownerUserId) : <span className="muted">—</span>}</td>
                    <td><span className="tags">{c.tags.map((t) => <Chip key={t} tone="gray">{t}</Chip>)}</span></td>
                    <td>{open || <span className="muted">0</span>}</td>
                    <td className="small">{active ? `${active} ฉบับ` : <span className="muted">ไม่มี</span>}{days !== null && days <= 30 && <div><Chip tone="amber">หมดใน {days} วัน</Chip></div>}</td>
                    <td><ConsentBadge customerId={c.id} /></td>
                    <td>{links ? `${links} โปรไฟล์` : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">ลูกค้าแต่ละรายผูกกับ LINE OA เดียว (channel + LINE User ID) ระบบไม่รวมโปรไฟล์อัตโนมัติ — ใช้การเชื่อมโปรไฟล์ที่ผ่าน consent และการอนุมัติแทน</p>
    </Card>
  );
}

function LinkRequests() {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'REQUESTED';
  const links = data.profileLinks
    .filter((l) => [l.customerAId, l.customerBId].some((id) => {
      const c = data.customers.find((x) => x.id === id);
      return c && canSeeCustomer(data, me, c);
    }))
    .filter((l) => status === 'ALL' || l.status === status)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  return (
    <Card title={`คำขอเชื่อมโปรไฟล์ข้าม OA (${links.length})`}>
      <div className="filters">
        <select aria-label="สถานะ" value={status} onChange={(e) => setParams({ view: 'links', status: e.target.value }, { replace: true })}>
          <option value="REQUESTED">รออนุมัติ</option>
          <option value="ALL">ทั้งหมด</option>
          <option value="APPROVED">เชื่อมแล้ว</option>
          <option value="SUSPENDED">ระงับ</option>
          <option value="REJECTED">ปฏิเสธ</option>
          <option value="UNLINKED">ยกเลิกการเชื่อม</option>
        </select>
      </div>
      <p className="muted small">อนุมัติได้โดย Manager ของแผนกเจ้าของ OA ฝั่งใดฝั่งหนึ่ง (ผู้ขออนุมัติเองไม่ได้) · ทั้งสองฝั่งต้องยินยอม “เชื่อมข้อมูลกับบริการอื่น” · ส่งคำขอได้จากหน้าโปรไฟล์ลูกค้า แท็บ Customer 360</p>
      <LinksTable links={links} emptyHint="ไม่มีคำขอในสถานะนี้" />
    </Card>
  );
}
