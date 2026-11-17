import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}
interface ToastStore {
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
}
let n = 0;
export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }].slice(-3) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (text: string) => useToasts.getState().push('success', text),
  error: (text: string) => useToasts.getState().push('error', text),
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          {t.kind === 'success' ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
          <span>{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="ปิดข้อความ">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
