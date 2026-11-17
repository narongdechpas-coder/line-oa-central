import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { can, canManageField, ROLE_LABEL } from '../../utils/permissions';
import { CUSTOM_FIELD_TYPES, ROLES, type CustomFieldDefinition, type CustomFieldType, type RoleCode } from '../../types/domain';
import { Button, Card, Field, Restricted } from '../../components/common/ui';
import { Chip, DemoTag } from '../../components/common/Chip';
import { Modal } from '../../components/overlays/Modal';

const TYPE_LABEL: Record<CustomFieldType, string> = { TEXT: 'ข้อความ', SELECT: 'ตัวเลือก', DATE: 'วันที่', BOOLEAN: 'ใช่/ไม่ใช่', NUMBER: 'ตัวเลข' };

export function CustomFieldsPage() {
  const data = useDemoStore((s) => s.data);
  const setActive = useDemoStore((s) => s.setFieldActive);
  const me = useActingUser();
  const L = useLookups();
  const [editing, setEditing] = useState<CustomFieldDefinition | 'new' | null>(null);
  if (!can(me, 'admin.view')) return <Restricted message="หน้าตั้งค่าฟิลด์สำหรับผู้ดูแลระบบเท่านั้น" />;
  const canCreate = can(me, 'field.manage');
  const usage = (key: string) => data.customers.filter((c) => c.customFields?.[key] !== undefined && c.customFields?.[key] !== null).length;

  return (
    <Card
      title={`Custom fields ของลูกค้า (${data.customFieldDefs.length})`}
      actions={canCreate && <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>เพิ่มฟิลด์</Button>}
    >
      <p className="muted small">กำหนดข้อมูลเพิ่มเติมของลูกค้าแยกตาม LINE OA และกำหนดว่าบทบาทไหนแก้ได้ · Dept Admin จัดการได้เฉพาะฟิลด์ของ OA ในแผนกตัวเอง · ฟิลด์ที่ตั้งเป็น PII จะแสดงแบบปิดบังและบันทึก audit เมื่อเปิดดู</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>ชื่อฟิลด์</th><th>ชนิด</th><th>ใช้กับ OA</th><th>แก้ไขได้โดย</th><th>PII</th><th>มีข้อมูล</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            {data.customFieldDefs.map((f) => {
              const manage = canManageField(data, me, f);
              return (
                <tr key={f.id}>
                  <td>{f.label}<div className="muted small mono">{f.key}</div></td>
                  <td>{TYPE_LABEL[f.type]}{f.options && <div className="muted small">{f.options.join(' / ')}</div>}</td>
                  <td className="small">{f.channelIds === 'ALL' ? 'ทุก OA' : f.channelIds.map((id) => L.channel(id)?.name).join(', ')}</td>
                  <td className="small">{f.editableByRoles.map((r) => ROLE_LABEL[r]).join(', ')}</td>
                  <td>{f.isPII ? <Chip tone="amber">PII</Chip> : '—'}</td>
                  <td>{usage(f.key)} ราย</td>
                  <td>{f.active ? <Chip tone="green">ใช้งาน</Chip> : <Chip tone="gray">ปิด</Chip>}</td>
                  <td>
                    <div className="btn-row">
                      <Button size="sm" disabled={!manage} title={manage ? undefined : 'จัดการได้เฉพาะฟิลด์ของ OA ในแผนกตัวเอง'} onClick={() => setEditing(f)}>แก้ไข</Button>
                      <Button size="sm" disabled={!manage} onClick={() => report(setActive(f.id, !f.active), f.active ? 'ปิดฟิลด์แล้ว (ข้อมูลเดิมยังอยู่)' : 'เปิดใช้ฟิลด์แล้ว')}>{f.active ? 'ปิด' : 'เปิด'}</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">ปิดฟิลด์แล้วข้อมูลที่บันทึกไว้ยังอยู่ แค่ไม่แสดงและแก้ไขไม่ได้ <DemoTag>DEMO</DemoTag></p>
      {editing && <FieldModal def={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function FieldModal({ def, onClose }: { def: CustomFieldDefinition | null; onClose: () => void }) {
  const data = useDemoStore((s) => s.data);
  const save = useDemoStore((s) => s.saveField);
  const me = useActingUser();
  const [label, setLabel] = useState(def?.label ?? '');
  const [key, setKey] = useState(def?.key ?? '');
  const [type, setType] = useState<CustomFieldType>(def?.type ?? 'TEXT');
  const [options, setOptions] = useState((def?.options ?? []).join('\n'));
  const ownChannels = data.channels.filter((c) => me.role === 'SUPER_ADMIN' || me.role === 'SYSTEM_ADMIN' || c.departmentId === me.departmentId);
  const [allChannels, setAllChannels] = useState(def ? def.channelIds === 'ALL' : false);
  const [channels, setChannels] = useState<string[]>(def && def.channelIds !== 'ALL' ? def.channelIds : ownChannels.map((c) => c.id));
  const [roles, setRoles] = useState<RoleCode[]>(def?.editableByRoles ?? ['MANAGER', 'SUPERVISOR', 'PIC_AGENT']);
  const [isPII, setIsPII] = useState(def?.isPII ?? false);
  const [required, setRequired] = useState(def?.required ?? false);
  const [error, setError] = useState<string | null>(null);
  const allScope = me.role === 'SUPER_ADMIN' || me.role === 'SYSTEM_ADMIN';

  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const submit = () => {
    const r = save({
      ...(def ? { id: def.id } : {}),
      label,
      key,
      type,
      ...(type === 'SELECT' ? { options: options.split('\n') } : {}),
      channelIds: allChannels ? 'ALL' : channels,
      editableByRoles: roles,
      isPII,
      required,
    });
    if (r.ok) { report(r, def ? 'บันทึกฟิลด์แล้ว' : 'เพิ่มฟิลด์แล้ว'); onClose(); } else setError(r.error);
  };

  return (
    <Modal title={def ? `แก้ไขฟิลด์ — ${def.label}` : 'เพิ่มฟิลด์'} onClose={onClose} width={620} footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" onClick={submit}>บันทึก</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid-2">
          <Field label="ชื่อฟิลด์" htmlFor="fd-label" required><input id="fd-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} /></Field>
          <Field label="key (อังกฤษ)" htmlFor="fd-key" required hint={def ? 'เปลี่ยนไม่ได้หลังสร้าง' : 'เช่น plateNo'}><input id="fd-key" value={key} readOnly={!!def} onChange={(e) => setKey(e.target.value)} maxLength={31} /></Field>
          <Field label="ชนิด" htmlFor="fd-type" hint={def ? 'เปลี่ยนไม่ได้หลังสร้าง' : undefined}>
            <select id="fd-type" value={type} disabled={!!def} onChange={(e) => setType(e.target.value as CustomFieldType)}>
              {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          {type === 'SELECT' && (
            <Field label="ตัวเลือก (บรรทัดละหนึ่ง)" htmlFor="fd-opts"><textarea id="fd-opts" rows={3} value={options} onChange={(e) => setOptions(e.target.value)} /></Field>
          )}
        </div>
        <fieldset className="radio-list">
          <legend>ใช้กับ LINE OA</legend>
          {allScope && <label className="check"><input type="checkbox" checked={allChannels} onChange={(e) => setAllChannels(e.target.checked)} /> ทุก OA</label>}
          {!allChannels && ownChannels.map((c) => (
            <label key={c.id} className="check"><input type="checkbox" checked={channels.includes(c.id)} onChange={() => setChannels((xs) => toggle(xs, c.id))} /> {c.name}</label>
          ))}
        </fieldset>
        <fieldset className="radio-list">
          <legend>บทบาทที่แก้ไขได้</legend>
          <div className="check-grid">
            {ROLES.filter((r) => r !== 'AUDITOR' && r !== 'SYSTEM_ADMIN').map((r) => (
              <label key={r} className="check"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles((xs) => toggle(xs, r))} /> {ROLE_LABEL[r]}</label>
            ))}
          </div>
        </fieldset>
        <div className="inline">
          <label className="check"><input type="checkbox" checked={isPII} onChange={(e) => setIsPII(e.target.checked)} /> เป็นข้อมูลส่วนบุคคล (PII) — ปิดบังและบันทึก audit เมื่อเปิดดู</label>
          <label className="check"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> บังคับกรอก</label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
