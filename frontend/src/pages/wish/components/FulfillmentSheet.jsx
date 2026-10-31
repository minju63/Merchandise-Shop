// 장바구니 담기 전 수령 방법 선택 (픽업 / 배달)
// 담당: 동균
// 담은 뒤에는 수령 방법을 바꿀 수 없으므로 자동으로 고르지 않고 사용자에게 묻는다.
import Icon from '../../../components/Icon.jsx';

// 상품이 지원하지 않는 수령 방법은 누를 수 없게 막는다 (서버도 FULFILLMENT_OFF 로 거절한다)
export default function FulfillmentSheet({ productName, isPending, pickupAvailable = true, deliveryAvailable = true, onSelect, onCancel }) {
  return (
    <div className="wish-dialog-backdrop wish-sheet-backdrop" onClick={isPending ? undefined : onCancel}>
      <div
        className="wish-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="wish-sheet-title">어떻게 받으실 건가요?</h2>
        <p className="wish-dialog-name">{productName}</p>
        <p className="wish-dialog-note">장바구니에 담은 뒤에는 수령 방법을 바꿀 수 없어요.</p>
        <div className="wish-sheet-options">
          <button type="button" disabled={isPending || !pickupAvailable} onClick={() => onSelect('PICKUP')}>
            <Icon name="bag" size={22} />
            {pickupAvailable ? '픽업' : '픽업 불가'}
          </button>
          <button type="button" disabled={isPending || !deliveryAvailable} onClick={() => onSelect('DELIVERY')}>
            <Icon name="truck" size={22} />
            {deliveryAvailable ? '배달' : '배달 불가'}
          </button>
        </div>
        <button type="button" className="wish-sheet-cancel" disabled={isPending} onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
