import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { canDecideLink, canUnlink } from '../../utils/permissions';
import { LINK_STATUS_LABEL, LINK_TONE } from '../../utils/labels';
import { formatDateTime } from '../../utils/time';
import type { ProfileLink } from '../../types/domain';
import { Button, EmptyState, Field } from '../../components/common/ui';
import { Chip } from '../../components/common/Chip';
import { ConfirmDialog } from '../../components/overlays/Modal';
import { ConsentBadge, CustomerLink } from './shared';

type Pending = { link: ProfileLink; action: 'APPROVE' | 'REJECT' | 'UNLINK' };

export function LinksTable({ links, emptyHint }: { links: ProfileLink[]; emptyHint?: string }) {
  const data = useDemoStore((s) => s.data);
  const decide = useDemoStore((s) => s.decideLink);
  const unlink = useDemoStore((s) => s.unlink);
  const me = useActingUser();
  const L = useLookups();
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  if (!links.length) return <EmptyState icon={<Link2 size={28} />} title="ไม่มีรายการเชื่อมโปรไฟล์" hint={emptyHint} />;

  const close = () => { setPending(null); setNote(''); setErr(null); };
  const confirm = () => {
    if (!pending) return;
    const needNote = pending.action !== 'APPROVE';
    if (needNote && !note.trim()) { setErr('กรุณาระบุเหตุผล'); return; }
    const r = pending.action === 'UNLINK' ? unlink(pending.link.id, note) : decide(pending.link.id, pending.action, note);
    if (report(r, pending.action === 'APPROVE' ? 'อนุมัติการเชื่อมโปรไฟล์แล้ว' : pending.action === 'REJECT' ? 'ปฏิเสธคำขอแล้ว' : 'ยกเลิกการเชื่อมแล้ว')) close();
  };

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>โปรไฟล์ A</th><th>โปรไฟล์ B</th><th>สถานะ</th><th>เหตุผล / หลักฐาน</th><th>ขอโดย</th><th>ตัดสินโดย</th><th></th></tr></thead>
          <tbody>
            {links.map((l) => {
              const decideOk = l.status === 'REQUESTED' && canDecideLink(data, me, l);
              const unlinkOk = (l.status === 'APPROVED' || l.status === 'SUSPENDED') && canUnlink(data, me, l);
              return (
                <tr key={l.id}>
                  <td><CustomerLink customerId={l.customerAId} /><div><ConsentBadge customerId={l.customerAId} /></div></td>
                  <td><CustomerLink customerId={l.customerBId} /><div><ConsentBadge customerId={l.customerBId} /></div></td>
                  <td><Chip tone={LINK_TONE[l.status]} title={l.status}>{LINK_STATUS_LABEL[l.status]}</Chip></td>
                  <td className="small">{l.reason}{l.endReason && <div className="muted">{l.endReason}</div>}{l.decisionNote && <div className="muted">หมายเหตุ: {l.decisionNote}</div>}</td>
                  <td className="small">{L.userName(l.requestedBy)}<div className="muted">{formatDateTime(l.requestedAt)}</div></td>
                  <td className="small">{l.decidedBy ? <>{L.userName(l.decidedBy)}<div className="muted">{l.decidedAt && formatDateTime(l.decidedAt)}</div></> : '—'}</td>
                  <td>
                    <div className="btn-row">
                      {l.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" variant="primary" disabled={!decideOk} title={decideOk ? undefined : l.requestedBy === me.id ? 'ผู้ขออนุมัติคำขอของตัวเองไม่ได้' : 'อนุมัติได้เฉพาะ Manager ของแผนกเจ้าของ OA'} onClick={() => setPending({ link: l, action: 'APPROVE' })}>อนุมัติ</Button>
                          <Button size="sm" variant="danger" disabled={!decideOk} onClick={() => setPending({ link: l, action: 'REJECT' })}>ปฏิเสธ</Button>
                        </>
                      )}
                      {(l.status === 'APPROVED' || l.status === 'SUSPENDED') && (
                        <Button size="sm" disabled={!unlinkOk} title={unlinkOk ? undefined : 'บทบาทนี้ยกเลิกการเชื่อมไม่ได้'} onClick={() => setPending({ link: l, action: 'UNLINK' })}>ยกเลิกการเชื่อม</Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pending && (
        <ConfirmDialog
          title={pending.action === 'APPROVE' ? 'อนุมัติการเชื่อมโปรไฟล์?' : pending.action === 'REJECT' ? 'ปฏิเสธคำขอเชื่อมโปรไฟล์?' : 'ยกเลิกการเชื่อมโปรไฟล์?'}
          message={
            pending.action === 'APPROVE'
              ? 'ระบบจะตรวจ consent ทั้งสองฝั่งอีกครั้ง โปรไฟล์ยังเป็นคนละ record และแต่ละฝั่งจะแสดงเฉพาะหมวดข้อมูลที่อยู่ใน consent ของตัวเอง'
              : pending.action === 'REJECT'
                ? 'คำขอนี้จะถูกปิด ต้องส่งคำขอใหม่ถ้าต้องการเชื่อมภายหลัง'
                : 'Customer 360 จะไม่แสดงข้อมูลของอีกฝั่งอีก การเชื่อมใหม่ต้องขออนุมัติอีกครั้ง'
          }
          confirmLabel={pending.action === 'APPROVE' ? 'อนุมัติ' : pending.action === 'REJECT' ? 'ปฏิเสธ' : 'ยกเลิกการเชื่อม'}
          danger={pending.action !== 'APPROVE'}
          onCancel={close}
          onConfirm={confirm}
        >
          <Field label={pending.action === 'APPROVE' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผล'} htmlFor="link-note" required={pending.action !== 'APPROVE'} error={err}>
            <textarea id="link-note" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErr(null); }} />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}
