import { useEffect } from 'react';
import './dialog.css';

// 브라우저 기본 alert/confirm 대신 화면 가운데에 띄우는 안내 상자.
// cancelLabel이 없으면 확인 버튼만 보이는 안내창이 된다.
export default function Dialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const close = onCancel ?? onConfirm;
    const onKey = (event) => {
      if (event.key === 'Escape') close?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;
  return (
    <div className="dlg-overlay" onClick={onCancel}>
      <div
        className="dlg"
        role="alertdialog"
        aria-modal="true"
        aria-label={title || message}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? <h2 className="dlg__title">{title}</h2> : null}
        <p className="dlg__message">{message}</p>
        <div className="dlg__actions">
          {cancelLabel ? (
            <button type="button" className="dlg__btn" onClick={onCancel}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={danger ? 'dlg__btn dlg__btn--primary is-danger' : 'dlg__btn dlg__btn--primary'}
            autoFocus
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
