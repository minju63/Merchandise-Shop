// 담당: 연수
// 쿠지 화면 공통 조각: 페이지 틀 · 헤더 · 등급 뱃지 · 하단 시트
import { BackIcon } from '../my/common.jsx';
import s from './kuji.module.css';
import { cx, gradeStyle } from './kujiUi.js';

export function KujiPage({ children }) {
  return <div className={s.root}>{children}</div>;
}

export function KujiHeader({ title, right = null, onBack }) {
  return (
    <header className={s.hd}>
      <button type="button" className={s.back} aria-label="뒤로" onClick={onBack}>
        <BackIcon />
      </button>
      <b>{title}</b>
      {right}
    </header>
  );
}

export function GradeBadge({ grade, className }) {
  return (
    <div className={cx(s.grade, className)} style={gradeStyle(grade)}>
      {grade}
    </div>
  );
}

export function StateBox({ message, onRetry }) {
  return (
    <div className={s.state}>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

export function Sheet({ label, onClose, children }) {
  return (
    <div
      className={s.rsheet}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={s.rcard} role="dialog" aria-label={label}>
        <div className={s.grab} />
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }) {
  return message ? (
    <div className={s.toast} role="status">
      {message}
    </div>
  ) : null;
}
