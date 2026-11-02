import { useEffect, useRef, useState } from 'react';

const CONDITIONS = [['openNow', '영업 중'], ['pickup', '픽업 가능'], ['delivery', '배달 가능']];

export default function StoreConditions({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const selected = CONDITIONS.filter(([key]) => filters[key]);
  const count = selected.length;
  const label = count ? selected.map(([, name]) => name).join(' + ') : '조건';
  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className="sort-control inventory-conditions" ref={root}>
    <button type="button" className={`sort-trigger inventory-conditions-trigger${count ? ' has-conditions' : ''}`}
      aria-expanded={open} aria-controls="store-conditions-panel"
      aria-label={`매장 조건: ${label}`} title={label} onClick={() => setOpen(!open)}>
      {label}
    </button>
    {open && <div className="sort-menu inventory-conditions-panel" id="store-conditions-panel" role="group" aria-label="매장 조건 선택">
      {CONDITIONS.map(([key, label]) => <label key={key} className={filters[key] ? 'is-selected' : ''}>
        <input type="checkbox" checked={filters[key]} onChange={() => { onChange(key); setOpen(false); }} />
        <span>{label}</span>
      </label>)}
    </div>}
  </div>;
}
