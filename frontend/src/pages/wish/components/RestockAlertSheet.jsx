// 재입고 알림 설정 (J-03)
// 담당: 동균
// 같은 상품이라도 매장마다 다른 알림이라 어느 매장의 알림인지 보여준다.
const dateText = (value) =>
  new Date(value).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

export default function RestockAlertSheet({ item, isPending, onConfirm, onCancel }) {
  return (
    <div className="wish-dialog-backdrop wish-sheet-backdrop" onClick={isPending ? undefined : onCancel}>
      <div
        className="wish-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-restock-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="wish-restock-title">재입고 알림</h2>
        <div className="wish-sheet-product">
          <span className="wish-sheet-thumb">
            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span className="wish-thumb-placeholder" />}
          </span>
          <div>
            <p className="wish-sheet-product-name">{item.productName}</p>
            <p className="wish-sheet-store">{item.storeName}</p>
          </div>
        </div>
        <p className="wish-sheet-message">이 매장에 재입고되면 알려드릴게요</p>
        {item.restockExpectedAt && (
          <p className="wish-dialog-note">입고 예정일 {dateText(item.restockExpectedAt)}</p>
        )}
        <button type="button" className="wish-sheet-primary" disabled={isPending} onClick={onConfirm}>
          {isPending ? '신청 중…' : '알림 신청하기'}
        </button>
        <button type="button" className="wish-sheet-cancel" disabled={isPending} onClick={onCancel}>
          닫기
        </button>
      </div>
    </div>
  );
}
