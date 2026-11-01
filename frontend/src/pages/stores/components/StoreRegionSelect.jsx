import { useEffect, useRef, useState } from 'react';
import { REGIONS } from '../../../constants/regions.js';
import { DISTRICTS } from '../../../../../shared/districts.js';
import Icon from './Icon.jsx';

export default function StoreRegionSelect({ region = '', district = '', onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const label = region ? `${region}${district ? ` ${district}` : ' 전체'}` : '전체 지역';
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const selectDistrict = (value) => { onChange(region, value); setOpen(false); };
  return <div className="sort-control inventory-region-select" ref={root}>
    <button type="button" className="sort-trigger" title={label} aria-label={`지역 선택: ${label}`}
      aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
      <span>{label}</span><Icon name="chevron" size={15} />
    </button>
    {open && <div className="sort-menu inventory-region-menu" role="dialog" aria-label="지역 및 시·군·구 선택">
      <div className="inventory-region-column" role="group" aria-label="시·도">
        <button type="button" className={!region ? 'is-selected' : ''}
          onClick={() => { onChange('', ''); setOpen(false); }}>전체 지역{!region && <Icon name="check" size={15} />}</button>
        {REGIONS.map((name) => <button type="button" key={name} className={region === name ? 'is-selected' : ''}
          aria-pressed={region === name} onClick={() => onChange(name, '')}>{name}{region === name && <Icon name="check" size={15} />}</button>)}
      </div>
      <div className="inventory-region-column" role="group" aria-label="시·군·구">
        {region ? <>
          <button type="button" className={!district ? 'is-selected' : ''} onClick={() => selectDistrict('')}>전체 시·군·구{!district && <Icon name="check" size={15} />}</button>
          {(DISTRICTS[region] || []).map((name) => <button type="button" key={name} className={district === name ? 'is-selected' : ''}
            aria-pressed={district === name} onClick={() => selectDistrict(name)}>{name}{district === name && <Icon name="check" size={15} />}</button>)}
        </> : <p>지역을 선택해 주세요</p>}
      </div>
    </div>}
  </div>;
}
