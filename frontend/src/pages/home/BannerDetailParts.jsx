import { useEffect, useRef, useState } from 'react';
import './HomePage.css';
import './BannerDetail.css';

// 배너 상세 화면 공통 틀: 상단바(뒤로가기·제목·공유) → 히어로 → 흰 섹션들 → 하단 고정 버튼
export function DetailShell({ title, ready, error, onBack, onRetry, hero, footer, children }) {
  const [toast, setToast] = useState('');

  const handleShare = async () => {
    const shareData = { title: document.title, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      setToast('링크를 복사했어요');
    } catch {
      setToast('공유할 수 없는 환경이에요');
    }
    window.setTimeout(() => setToast(''), 1800);
  };

  return (
    <div className="home-shell bd">
      <header className="bd__bar">
        <button type="button" aria-label="뒤로 가기" onClick={onBack}>‹</button>
        <h1>{title}</h1>
        <button type="button" aria-label="공유하기" onClick={handleShare}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
        </button>
      </header>

      {error ? (
        <div className="bd__status">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>다시 시도</button>
        </div>
      ) : !ready ? (
        <p className="bd__status">불러오는 중...</p>
      ) : (
        <main>
          {hero}
          {children}
        </main>
      )}

      {footer && ready && !error ? <div className="bd__footer">{footer}</div> : null}
      {toast ? <p className="bd__toast" role="status">{toast}</p> : null}
    </div>
  );
}

export function DetailSection({ title, description, children, className = '' }) {
  return (
    <section className={`bd__section ${className}`}>
      {title ? (
        <div className="bd__section-head">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function NoticeList({ items }) {
  return (
    <ul className="bd__notice">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

// 검색 결과 화면의 정렬 드롭다운(ProductSortMenu)과 같은 모양·동작
export function SortMenu({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!menu.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  return (
    <div className="bd__sort" ref={menu}>
      <button type="button" aria-label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
        {options.find(([optionValue]) => optionValue === value)?.[1] ?? options[0][1]} <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="bd__sort-menu" role="menu">
          {options.map(([optionValue, optionLabel]) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === optionValue}
              key={optionValue}
              onClick={() => { onChange(optionValue); setOpen(false); }}
            >
              {optionLabel}{value === optionValue ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
