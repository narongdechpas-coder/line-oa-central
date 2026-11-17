import { useMemo, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Clock,
  ClipboardList,
  FileBarChart,
  Inbox,
  LayoutDashboard,
  MessageSquareShare,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report } from '../../store/hooks';
import { can, canDecideEscalation, canSeeCase, ROLE_LABEL } from '../../utils/permissions';
import { computeSla } from '../../utils/sla';
import { isCaseOpen } from '../../utils/transitions';
import { formatDateTime } from '../../utils/time';
import { ConfirmDialog } from '../overlays/Modal';
import { Toaster, toast } from '../overlays/toast';
import { Avatar } from '../common/ui';
import { ROLES } from '../../types/domain';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/cases', label: 'Cases', icon: Briefcase },
  { to: '/escalations', label: 'Escalations', icon: MessageSquareShare },
  { to: '/tasks', label: 'งานภายใน', icon: ClipboardList },
  { to: '/reports', label: 'Reports', icon: FileBarChart, perm: 'reports.view' as const },
];
const ADMIN_NAV = [
  { to: '/admin/channels', label: 'LINE OA Channels', icon: Radio },
  { to: '/admin/access', label: 'Roles & Access', icon: ShieldCheck },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Dashboard'],
  [/^\/inbox/, 'Unified Inbox'],
  [/^\/cases\/.+/, 'Case Workspace'],
  [/^\/cases/, 'Cases'],
  [/^\/escalations/, 'Internal Escalation'],
  [/^\/tasks/, 'งานภายใน (Internal Tasks)'],
  [/^\/reports/, 'Reports & Analytics'],
  [/^\/admin\/channels/, 'LINE OA Channel Management'],
  [/^\/admin\/access/, 'Authority & Access Control'],
];

export function AppShell() {
  const me = useActingUser();
  const loc = useLocation();
  const title = TITLES.find(([re]) => re.test(loc.pathname))?.[1] ?? 'Jacky Central';
  const [confirmReset, setConfirmReset] = useState(false);
  const resetDemo = useDemoStore((s) => s.resetDemo);
  const nav = useNavigate();

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="เมนูหลัก">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">JC</span>
          <span className="brand-text">
            Jacky Central
            <small>Communication & Case Mgmt</small>
          </span>
        </div>
        <nav className="nav">
          {NAV.filter((n) => !n.perm || can(me, n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-item">
              <n.icon size={18} aria-hidden="true" />
              <span>{n.label}</span>
            </NavLink>
          ))}
          {can(me, 'admin.view') && (
            <>
              <p className="nav-group">Administration</p>
              {ADMIN_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className="nav-item">
                  <n.icon size={18} aria-hidden="true" />
                  <span>{n.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <Avatar name={me.name} size={32} />
            <div className="me-text">
              <strong>{me.name}</strong>
              <small>{ROLE_LABEL[me.role]}</small>
            </div>
          </div>
          <button type="button" className="reset-btn" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Reset demo data</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="page-title">{title}</h1>
          <GlobalSearch />
          <div className="topbar-right">
            <DemoClock />
            <Notifications />
            <RoleSwitcher />
            <span className="demo-mode" title="ทุกอย่างในหน้านี้เป็นข้อมูลจำลอง ไม่ได้เชื่อมต่อ LINE OA">DEMO MODE</span>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset demo data?"
          message="ข้อมูลทุกอย่างที่แก้ไขในเบราว์เซอร์นี้จะหายไป และกลับเป็นข้อมูลตั้งต้น (seed)"
          confirmLabel="Reset"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            resetDemo();
            setConfirmReset(false);
            toast.success('กลับเป็นข้อมูลตั้งต้นแล้ว');
            nav('/');
          }}
        />
      )}
      <Toaster />
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/cases?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <form className="search" role="search" onSubmit={submit}>
      <Search size={16} aria-hidden="true" />
      <input aria-label="ค้นหา Case" placeholder="ค้นหาเลข Case, หัวข้อ, ชื่อลูกค้า…" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}

function DemoClock() {
  const now = useDemoStore((s) => s.now);
  const advance = useDemoStore((s) => s.advanceTime);
  return (
    <div className="clock" title="นาฬิกาเดโม่ (SIMULATED) — ใช้คำนวณ SLA">
      <Clock size={14} aria-hidden="true" />
      <span>{formatDateTime(now)}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => report(advance(60), 'เลื่อนเวลาเดโม่ +1 ชั่วโมง')}>
        +1 ชม.
      </button>
    </div>
  );
}

function RoleSwitcher() {
  const users = useDemoStore((s) => s.data.users);
  const deps = useDemoStore((s) => s.data.departments);
  const actingUserId = useDemoStore((s) => s.actingUserId);
  const switchUser = useDemoStore((s) => s.switchUser);
  const depName = (id: string | null) => deps.find((d) => d.id === id)?.name ?? 'ทุกแผนก';
  return (
    <div className="role-switch">
      <label htmlFor="role-switch">DEMO ROLE — permissions are simulated</label>
      <select
        id="role-switch"
        value={actingUserId}
        onChange={(e) => {
          const u = users.find((x) => x.id === e.target.value);
          if (report(switchUser(e.target.value)) && u) toast.success(`สลับเป็น ${u.name} (${ROLE_LABEL[u.role]})`);
        }}
      >
        {ROLES.map((r) => {
          const group = users.filter((u) => u.role === r);
          if (!group.length) return null;
          return (
            <optgroup key={r} label={ROLE_LABEL[r]}>
              {group.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {depName(u.departmentId)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const data = useDemoStore((s) => s.data);
  const now = useDemoStore((s) => s.now);
  const me = useActingUser();
  const nav = useNavigate();
  const items = useMemo(() => {
    const sla = data.cases
      .filter((c) => isCaseOpen(c.status) && canSeeCase(data, me, c))
      .map((c) => ({ c, s: computeSla(c, now) }))
      .filter((x) => x.s.state === 'BREACHED' || x.s.state === 'AT_RISK')
      .map((x) => ({ key: x.c.id, to: `/cases/${x.c.id}`, text: `${x.c.caseNumber} SLA ${x.s.state === 'BREACHED' ? 'เกินกำหนด' : 'ใกล้ครบกำหนด'}` }));
    const esc = data.escalations
      .filter((e) => (e.status === 'REQUESTED' || e.status === 'UNDER_REVIEW') && canDecideEscalation(me, e))
      .map((e) => ({ key: e.id, to: `/cases/${e.caseId}?tab=escalation`, text: `Escalation รอพิจารณา: ${data.cases.find((c) => c.id === e.caseId)?.caseNumber ?? ''}` }));
    return [...esc, ...sla];
  }, [data, now, me]);

  return (
    <div className="notif">
      <button type="button" className="icon-btn" aria-label={`การแจ้งเตือน ${items.length} รายการ`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {items.length > 0 && <span className="badge">{items.length}</span>}
      </button>
      {open && (
        <div className="notif-pop" role="menu">
          <p className="notif-head">การแจ้งเตือนในระบบ (ไม่มีการส่งออกภายนอก)</p>
          {items.length === 0 && <p className="muted small pad">ไม่มีการแจ้งเตือน</p>}
          {items.slice(0, 12).map((i) => (
            <button
              key={i.key}
              type="button"
              role="menuitem"
              className="notif-item"
              onClick={() => {
                setOpen(false);
                nav(i.to);
              }}
            >
              {i.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

