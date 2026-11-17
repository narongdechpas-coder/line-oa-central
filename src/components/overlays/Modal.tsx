import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Accessible modal: Esc closes, focus moves in on open and returns on close, focus is trapped. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 560,
  side = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  side?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)');
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (x) => !x.hasAttribute('disabled'),
        );
        if (!items.length) return;
        const a = items[0]!;
        const z = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={`overlay ${side ? 'overlay-side' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={side ? 'drawer' : 'modal'} style={side ? undefined : { maxWidth: width }} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref} tabIndex={-1}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'ยืนยัน',
  danger,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary btn-md" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className={`btn btn-md ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-msg">{message}</div>
      {children}
    </Modal>
  );
}
