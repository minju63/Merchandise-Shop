// 찜 해제 확인 (J-07)
// 담당: 동균
export default function WishRemoveDialog({ type, name, isPending, isError, onCancel, onConfirm }) {
  return (
    <div className="wish-dialog-backdrop" onClick={isPending ? undefined : onCancel}>
      <div
        className="wish-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="wish-dialog-title">찜을 해제할까요?</h2>
        <p className="wish-dialog-name">{name}</p>
        {type === 'product' && (
          <p className="wish-dialog-note">연결된 재입고 알림도 함께 취소됩니다.</p>
        )}
        {isError && (
          <p className="wish-dialog-error" role="alert">
            찜 해제에 실패했습니다. 다시 시도해 주세요.
          </p>
        )}
        <div className="wish-dialog-actions">
          <button type="button" className="wish-dialog-cancel" onClick={onCancel} disabled={isPending}>
            취소
          </button>
          <button type="button" className="wish-dialog-confirm" onClick={onConfirm} disabled={isPending}>
            {isPending ? '해제 중…' : '해제'}
          </button>
        </div>
      </div>
    </div>
  );
}
