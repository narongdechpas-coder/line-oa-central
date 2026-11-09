import type { ReactNode } from 'react';

/** Labelled horizontal bars. Values are always printed, so colour never carries meaning alone. */
export function BarList({ rows, onSelect }: { rows: { key: string; label: ReactNode; value: number; hint?: string }[]; onSelect?: (key: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="bl-label">{r.label}</span>
            <span className="bl-track" aria-hidden="true"><span className="bl-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="bl-val">{r.value}{r.hint && <span className="muted small"> {r.hint}</span>}</span>
          </>
        );
        return (
          <li key={r.key}>
            {onSelect ? <button type="button" className="bl-row" onClick={() => onSelect(r.key)}>{inner}</button> : <div className="bl-row">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}
