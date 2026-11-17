import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { can } from '../../utils/permissions';
import { isCaseOpen } from '../../utils/transitions';
import { Card, Restricted } from '../../components/common/ui';
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
    </div>
  );
}
