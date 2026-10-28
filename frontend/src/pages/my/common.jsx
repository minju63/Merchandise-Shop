import { useNavigate } from 'react-router-dom';
import { ImageIcon } from './icons.jsx';

export function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function PageHeader({ title, right = null }) {
  const navigate = useNavigate();
  return (
    <header className="ord-header">
      <button
        type="button"
        className="ord-header__back"
        aria-label="뒤로"
        onClick={() => navigate(-1)}
      >
        <BackIcon />
      </button>
      <h1 className="ord-header__title">{title}</h1>
      {right ? <span className="ord-header__right">{right}</span> : null}
    </header>
  );
}

export function Thumb({ src, size = 64 }) {
  return (
    <span className="ord-thumb" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" /> : <ImageIcon />}
    </span>
  );
}

export function Loading() {
  return <div className="my-loading" role="status" aria-label="불러오는 중" />;
}

export function ErrorNotice({ error, onRetry }) {
  return (
    <div className="ord-error">
      <p>{error?.message || '정보를 불러오지 못했어요'}</p>
      {onRetry ? (
        <button type="button" className="my-primary-btn" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
