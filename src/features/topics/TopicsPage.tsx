import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Plus } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { can, canManageTopic } from '../../utils/permissions';
import { isEligiblePic } from '../../utils/scoring';
import { isCaseOpen } from '../../utils/transitions';
import type { Topic } from '../../types/domain';
import { Avatar, Button, Card, Field, Restricted } from '../../components/common/ui';
import { Chip } from '../../components/common/Chip';
import { Modal } from '../../components/overlays/Modal';

/** Admin setup: Department → topics it receives → ordered PIC list; plus departments that see the log. */
export function TopicsPage() {
  const data = useDemoStore((s) => s.data);
  const setActive = useDemoStore((s) => s.setTopicActive);
  const me = useActingUser();
  const L = useLookups();
  const [editing, setEditing] = useState<Topic | { newFor: string } | null>(null);
  if (!can(me, 'admin.view')) return <Restricted message="หน้าตั้งค่าหัวข้อสำหรับผู้ดูแลระบบเท่านั้น" />;

  return (
    <div className="stack">
      <div className="banner info">
        ตั้งค่าว่าแต่ละหัวข้อเรื่อง <strong>แผนกไหนรับเรื่อง</strong> (เป็นเจ้าของ Case และมีรายชื่อ PIC เรียงลำดับ) และ <strong>แผนกไหนเห็น log ได้</strong> (ดูได้อย่างเดียว) — ใช้ตอน Agent สร้าง Case จากบทสนทนา
      </div>
      {data.departments.map((dep) => {
        const receives = data.topics.filter((t) => t.responsibleDepartmentId === dep.id);
        const watches = data.topics.filter((t) => t.observerDepartmentIds.includes(dep.id));
        const canAdd = canManageTopic(me, { responsibleDepartmentId: dep.id });
        return (
          <Card
            key={dep.id}
            title={<>{dep.name} <Chip tone="gray">{receives.length} หัวข้อ</Chip></>}
            actions={canAdd && <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing({ newFor: dep.id })}>เพิ่มหัวข้อ</Button>}
          >
            {receives.length === 0 ? (
              <p className="muted small">แผนกนี้ยังไม่ได้รับเรื่องหัวข้อใด</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>หัวข้อ</th><th>PIC (ตามลำดับ)</th><th>เห็น log</th><th>ทักษะ</th><th>Case เปิด</th><th>สถานะ</th><th></th></tr></thead>
                  <tbody>
                    {receives.map((t) => {
                      const manage = canManageTopic(me, t);
                      const open = data.cases.filter((c) => c.topicId === t.id && isCaseOpen(c.status)).length;
                      return (
                        <tr key={t.id}>
                          <td><strong>{t.name}</strong>{t.description && <div className="muted small">{t.description}</div>}</td>
                          <td><ol className="pic-order">{t.picUserIds.map((id) => <li key={id}>{L.userName(id)}</li>)}</ol></td>
                          <td className="small">{t.observerDepartmentIds.length ? t.observerDepartmentIds.map((d) => L.depName(d)).join(', ') : <span className="muted">—</span>}</td>
                          <td className="small">{t.skills.join(', ')}</td>
                          <td>{open}</td>
                          <td>{t.active ? <Chip tone="green">ใช้งาน</Chip> : <Chip tone="gray">ปิด</Chip>}</td>
                          <td>
                            <div className="btn-row">
                              <Button size="sm" disabled={!manage} title={manage ? undefined : 'Dept Admin จัดการได้เฉพาะหัวข้อของแผนกตัวเอง'} onClick={() => setEditing(t)}>แก้ไข</Button>
                              <Button size="sm" disabled={!manage} onClick={() => report(setActive(t.id, !t.active), t.active ? 'ปิดหัวข้อแล้ว (Case เดิมไม่เปลี่ยน)' : 'เปิดใช้หัวข้อแล้ว')}>{t.active ? 'ปิด' : 'เปิด'}</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {watches.length > 0 && (
              <p className="small muted inline"><Eye size={12} aria-hidden="true" /> เห็น log ของหัวข้อ: {watches.map((t) => `${t.name} (${L.depName(t.responsibleDepartmentId)})`).join(', ')}</p>
            )}
          </Card>
        );
      })}
      <p className="muted small">แก้ไขหัวข้อมีผลกับ Case ใหม่และการมอบหมาย PIC ครั้งถัดไป Case ที่มีอยู่ไม่ย้ายแผนก</p>
      {editing && <TopicModal topic={'id' in editing ? editing : null} defaultDep={'newFor' in editing ? editing.newFor : undefined} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TopicModal({ topic, defaultDep, onClose }: { topic: Topic | null; defaultDep?: string; onClose: () => void }) {
  const data = useDemoStore((s) => s.data);
  const save = useDemoStore((s) => s.saveTopic);
  const me = useActingUser();
  const L = useLookups();
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [skills, setSkills] = useState((topic?.skills ?? []).join(', '));
  const [dep, setDep] = useState(topic?.responsibleDepartmentId ?? defaultDep ?? '');
  const [observers, setObservers] = useState<string[]>(topic?.observerDepartmentIds ?? []);
  const [pics, setPics] = useState<string[]>(topic?.picUserIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const deptOptions = data.departments.filter((d) => canManageTopic(me, { responsibleDepartmentId: d.id }));
  const eligible = data.users.filter((u) => u.departmentId === dep && isEligiblePic(u));

  const toggle = (id: string) => setPics((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const move = (i: number, delta: number) =>
    setPics((xs) => {
      const j = i + delta;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const submit = () => {
    const r = save({
      ...(topic ? { id: topic.id } : {}),
      name,
      description,
      skills: skills.split(','),
      responsibleDepartmentId: dep,
      observerDepartmentIds: observers,
      picUserIds: pics,
    });
    if (r.ok) { report(r, topic ? 'บันทึกหัวข้อแล้ว' : 'เพิ่มหัวข้อแล้ว'); onClose(); } else setError(r.error);
  };

  return (
    <Modal title={topic ? `แก้ไขหัวข้อ — ${topic.name}` : 'เพิ่มหัวข้อ'} onClose={onClose} width={640} footer={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" onClick={submit}>บันทึก</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid-2">
          <Field label="ชื่อหัวข้อ" htmlFor="tp-name" required><input id="tp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <Field label="แผนกที่รับเรื่อง" htmlFor="tp-dep" required>
            <select id="tp-dep" value={dep} onChange={(e) => { setDep(e.target.value); setPics([]); setObservers((o) => o.filter((x) => x !== e.target.value)); }}>
              <option value="">— เลือก —</option>
              {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="คำอธิบาย" htmlFor="tp-desc"><input id="tp-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={150} /></Field>
        <Field label="ทักษะที่ใช้ (คั่นด้วย ,)" htmlFor="tp-skills" hint="ใช้คำนวณคะแนนทักษะ 35% ของ PIC"><input id="tp-skills" value={skills} onChange={(e) => setSkills(e.target.value)} /></Field>
        <fieldset className="radio-list">
          <legend>แผนกที่เห็น log ได้ (ดูอย่างเดียว)</legend>
          <div className="check-grid">
            {data.departments.filter((d) => d.id !== dep).map((d) => (
              <label key={d.id} className="check"><input type="checkbox" checked={observers.includes(d.id)} onChange={() => setObservers((xs) => (xs.includes(d.id) ? xs.filter((x) => x !== d.id) : [...xs, d.id]))} /> {d.name}</label>
            ))}
          </div>
        </fieldset>
        <fieldset className="radio-list">
          <legend>PIC ของหัวข้อ (จาก {dep ? L.depName(dep) : 'แผนกที่รับเรื่อง'})</legend>
          {!dep && <p className="muted small">เลือกแผนกที่รับเรื่องก่อน</p>}
          <div className="check-grid">
            {eligible.map((u) => <label key={u.id} className="check"><input type="checkbox" checked={pics.includes(u.id)} onChange={() => toggle(u.id)} /> {u.name}</label>)}
          </div>
          {pics.length > 0 && (
            <ol className="pic-sort" aria-label="ลำดับ PIC">
              {pics.map((id, i) => (
                <li key={id}>
                  <span className="inline"><Avatar name={L.userName(id)} size={22} /> {i + 1}. {L.userName(id)}</span>
                  <span className="btn-row">
                    <button type="button" className="icon-btn" aria-label={`เลื่อน ${L.userName(id)} ขึ้น`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                    <button type="button" className="icon-btn" aria-label={`เลื่อน ${L.userName(id)} ลง`} disabled={i === pics.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="muted small">ลำดับนี้ใช้แสดงรายชื่อ ส่วนคำแนะนำยังเรียงตามคะแนน และผู้ดูแลหลักของลูกค้าขึ้นก่อนเสมอถ้าอยู่ในรายชื่อ</p>
        </fieldset>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
