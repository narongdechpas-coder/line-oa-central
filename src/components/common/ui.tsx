import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action}
    </div>
  );
}

export function Restricted({ message = 'บทบาทเดโม่นี้ไม่มีสิทธิ์ดูส่วนนี้' }: { message?: string }) {
  return (
    <div className="restricted" role="note">
      <Lock size={18} aria-hidden="true" />
      <div>
        <strong>จำกัดสิทธิ์ตามบทบาท</strong>
        <p>{message}</p>
        <p className="muted small">DEMO ROLE — permissions are simulated. เปลี่ยนบทบาทได้ที่มุมขวาบน</p>
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, required, error, hint, children }: { label: string; htmlFor: string; required?: boolean; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Staff photo when `userId` is given (public/avatars/<userId>.webp), otherwise initials.
 * Customers never get a photo. A missing file falls back to initials.
 */
export function Avatar({ name, size = 28, userId }: { name: string; size?: number; userId?: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (userId && !broken) {
    return (
      <img
        className="avatar avatar-photo"
        src={`/avatars/${userId}.webp`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials}
    </span>
  );
}

/** Small staff photo + name, used wherever an owner, PIC or requester is listed. */
export function UserChip({ userId, name, size = 22 }: { userId: string | null | undefined; name: string; size?: number }) {
  if (!userId) return <span className="muted">{name || '—'}</span>;
  return (
    <span className="user-chip">
      <Avatar name={name} size={size} userId={userId} />
      <span>{name}</span>
    </span>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v], i) => (
        <div key={i} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
