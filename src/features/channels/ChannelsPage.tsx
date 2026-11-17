import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { can } from '../../utils/permissions';
import { isCaseOpen } from '../../utils/transitions';
import { Card, Restricted } from '../../components/common/ui';
import { CATEGORY_LABEL, PURPOSE_LABEL } from '../../utils/consent';
import { Chip } from '../../components/common/Chip';
import { DemoTag } from '../../components/common/Chip';

export function ChannelsPage() {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const L = useLookups();
  if (!can(me, 'admin.view')) return <Restricted message="หน้าตั้งค่า LINE OA สำหรับผู้ดูแลระบบเท่านั้น" />;
  return (
    <div className="stack">
      <div className="banner warn">
        <Radio size={14} aria-hidden="true" /> ทุก LINE OA ในหน้านี้เป็นช่องทางจำลอง ไม่มีการเชื่อมต่อ LINE Messaging API, webhook หรือ token ใดๆ และไม่มีฟอร์มกรอก credential
      </div>
      <Card title={`LINE OA (${data.channels.length})`}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>LINE OA</th><th>แผนกเจ้าของ</th><th>สถานะการเชื่อมต่อ</th><th>ลูกค้า</th><th>บทสนทนา</th><th>Case เปิด</th><th></th></tr></thead>
            <tbody>
              {data.channels.map((ch) => (
                <tr key={ch.id}>
                  <td><span className="inline"><span className="ch-dot" style={{ background: ch.color }} aria-hidden="true" /><strong>{ch.name}</strong></span><div className="muted small mono">{ch.id}</div></td>
                  <td>{L.depName(ch.departmentId)}</td>
                  <td><DemoTag>SIMULATED — NOT CONNECTED</DemoTag></td>
                  <td>{data.customers.filter((c) => c.channelId === ch.id).length}</td>
                  <td>{data.conversations.filter((c) => c.channelId === ch.id).length}</td>
                  <td>{data.cases.filter((c) => c.originalChannelId === ch.id && isCaseOpen(c.status)).length}</td>
                  <td><Link className="btn btn-secondary btn-sm" to={`/inbox?channel=${ch.id}`}>ดูใน Inbox</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">แต่ละ OA เป็นช่องทางอิสระ ลูกค้าผูกกับ OA ที่ทักเข้ามาเท่านั้น (channel + LINE User ID) และการตอบกลับใช้ OA เดิมเสมอ</p>
      </Card>

      <Card title={<>ข้อความขอความยินยอม (Consent notice) <DemoTag>ตัวอย่าง — ไม่ใช่ข้อความทางกฎหมาย</DemoTag></>}>
        <p className="muted small">แสดงให้ลูกค้าเห็นตอนขอรับบริการผ่าน OA (จำลอง) ระบุขอบเขตการเก็บและใช้ข้อมูลให้ตรงกับบริการของ OA นั้น ข้อ “เชื่อมข้อมูลกับบริการอื่น” แยกเป็นข้อที่ลูกค้าเลือกได้</p>
        <div className="notice-grid">
          {data.consentNotices.map((n) => {
            const recs = data.consentRecords.filter((r) => r.noticeId === n.id);
            const linking = recs.filter((r) => r.grantedPurposes.includes('CROSS_SERVICE_LINKING')).length;
            return (
              <article key={n.id} className="esc-card">
                <header className="esc-head"><strong>{n.title}</strong><Chip tone="gray">v{n.version}</Chip></header>
                <p className="small muted">{data.channels.find((c) => c.id === n.channelId)?.name} · ลูกค้ายอมรับ {recs.length} ราย · ยินยอมเชื่อมข้อมูล {linking} ราย</p>
                <ul className="purpose-list">
                  {n.purposes.map((p) => <li key={p.purpose}><Chip tone={p.required ? 'blue' : 'gray'}>{p.required ? 'จำเป็น' : 'เลือกได้'}</Chip> {PURPOSE_LABEL[p.purpose]}</li>)}
                </ul>
                <div className="tags">{n.dataCategories.map((x) => <Chip key={x} tone="neutral">{CATEGORY_LABEL[x]}</Chip>)}</div>
                <details>
                  <summary className="small link-btn">ดูข้อความเต็ม</summary>
                  <p className="consent-body small">{n.body}</p>
                  <p className="muted small">ระยะเวลาเก็บ: {n.retentionText}</p>
                </details>
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
