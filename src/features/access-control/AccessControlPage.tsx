import { Check, Minus } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { useLookups } from '../../store/hooks';
import { ROLE_LABEL, ROLE_PERMISSIONS, ROLE_SCOPE, can, type Permission } from '../../utils/permissions';
import { formatDateTime } from '../../utils/time';
import { ROLES } from '../../types/domain';
import { Card, Restricted } from '../../components/common/ui';
import { DemoTag } from '../../components/common/Chip';

const PERM_LABEL: Record<Permission, string> = {
  'case.create': 'สร้าง Case',
  'case.update': 'เปลี่ยนสถานะ / ความสำคัญ',
  'case.assign': 'มอบหมาย PIC',
  'conversation.reply': 'ตอบลูกค้า (จำลอง)',
  'escalation.request': 'ขอ Escalation',
  'escalation.decide': 'พิจารณา / รับ / ปฏิเสธ Escalation',
  'escalation.work': 'เริ่ม / Resolve Escalation',
  'task.create': 'สร้างงานภายใน',
  'task.update': 'อัปเดตงาน / ความคิดเห็น',
  'admin.view': 'ดูหน้า Administration',
  'reports.view': 'ดู Reports',
  'audit.view': 'ดู Audit log',
};
const SCOPE_LABEL = { ALL: 'ทั้งองค์กร', DEPARTMENT: 'แผนกของตนเอง', ASSIGNED_RESOURCE: 'เฉพาะงานที่ได้รับมอบหมาย' };

export function AccessControlPage() {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const L = useLookups();
  if (!can(me, 'admin.view')) return <Restricted message="หน้าสิทธิ์การเข้าถึงสำหรับผู้ดูแลระบบและผู้ตรวจสอบเท่านั้น" />;
  const perms = Object.keys(PERM_LABEL) as Permission[];
  const audit = [...data.audit].reverse().slice(0, 30);

  return (
    <div className="stack">
      <Card title={<>RBAC + Resource Scope <DemoTag>DEMO ROLE — permissions are simulated</DemoTag></>}>
        <div className="grid-2 gap">
          <div>
            <h3 className="side-sub">RBAC — บทบาททำอะไรได้</h3>
            <p className="small">แต่ละบทบาทมีชุดสิทธิ์การกระทำ (permission) ตายตัว เช่น Manager มอบหมาย PIC ได้ แต่ PIC ทำไม่ได้</p>
          </div>
          <div>
            <h3 className="side-sub">ABAC / Resource scope — เห็นข้อมูลไหนได้</h3>
            <p className="small">สิทธิ์ถูกจำกัดด้วยขอบเขต: ทั้งองค์กร, แผนกของตนเอง (รวม Case ที่ส่งต่อเข้า/ออกแผนก) หรือเฉพาะงานที่ได้รับมอบหมาย</p>
          </div>
        </div>
        <p className="muted small">เดโม่นี้แสดงแนวคิดผ่านพฤติกรรมของหน้าจอเท่านั้น ไม่ใช่ระบบยืนยันตัวตนหรือขอบเขตความปลอดภัยจริง ไม่มีการสร้างผู้ใช้หรือ login</p>
      </Card>

      <Card title="Permission matrix">
        <div className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th>สิทธิ์</th>
                {ROLES.map((r) => <th key={r} className={r === me.role ? 'is-me' : ''}>{ROLE_LABEL[r]}{r === me.role && <div className="small">(บทบาทปัจจุบัน)</div>}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>ขอบเขตข้อมูล</strong></td>
                {ROLES.map((r) => <td key={r} className={r === me.role ? 'is-me' : ''}>{SCOPE_LABEL[ROLE_SCOPE[r]]}</td>)}
              </tr>
              {perms.map((p) => (
                <tr key={p}>
                  <td>{PERM_LABEL[p]}<div className="muted small mono">{p}</div></td>
                  {ROLES.map((r) => (
                    <td key={r} className={r === me.role ? 'is-me' : ''}>
                      {ROLE_PERMISSIONS[r].includes(p) ? <span className="yes"><Check size={14} aria-hidden="true" /> ได้</span> : <span className="no"><Minus size={14} aria-hidden="true" /> ไม่ได้</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">กติกาเพิ่มเติม: PIC แก้ไขได้เฉพาะ Case ที่ตนเป็นเจ้าของ · การรับ/ปฏิเสธ Escalation ต้องเป็น Manager/Supervisor ของแผนกปลายทาง · Auditor อ่านอย่างเดียว</p>
      </Card>

      <Card title="ผู้ใช้เดโม่">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ชื่อ</th><th>บทบาท</th><th>แผนก / ทีม</th><th>ขอบเขต</th><th>ทักษะ</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className={u.id === me.id ? 'is-me' : ''}>
                  <td>{u.name}{u.id === me.id && <span className="muted small"> (กำลังใช้อยู่)</span>}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.departmentId ? `${L.depName(u.departmentId)} / ${L.teamName(u.teamId)}` : 'ทุกแผนก'}</td>
                  <td>{SCOPE_LABEL[ROLE_SCOPE[u.role]]}</td>
                  <td className="small">{u.skills.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {can(me, 'audit.view') && (
        <Card title="Audit log (การกระทำในเดโม่นี้)">
          {audit.length === 0 ? <p className="muted">ยังไม่มีการกระทำ — ลองสร้าง Case หรือมอบหมาย PIC</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>การกระทำ</th><th>รายการ</th><th>ผล</th></tr></thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="nowrap">{formatDateTime(a.createdAt)}</td>
                      <td>{L.userName(a.actorId)}</td>
                      <td className="mono small">{a.action}</td>
                      <td className="mono small">{a.resourceType} {a.resourceId}</td>
                      <td>{a.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
