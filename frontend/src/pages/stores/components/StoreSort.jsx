import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function StoreSort({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="sort-control" ref={root}>
      <button
        className="sort-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {options.find((item) => item.value === value)?.label}
        <Icon name="chevron" size={15} />
      </button>
      {open && (
        <div className="sort-menu" role="listbox" aria-label="정렬 기준">
          {options.map((item) => (
            <button
              key={item.value}
              role="option"
              aria-selected={value === item.value}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
            >
              {item.label}
              {value === item.value && <Icon name="check" size={17} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
