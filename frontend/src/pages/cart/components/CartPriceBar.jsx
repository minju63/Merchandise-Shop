// 하단 고정 합계 바
// 담당: 동균
import { won } from '../cartFormat.js';

export default function CartPriceBar({ type, selectedCount, grandTotal, onOrder }) {
  return (
    <div className="cart-price-bar">
      <div className="cart-price-summary">
        <span>선택 {selectedCount}개</span>
        <strong>{won(grandTotal)}</strong>
        {type === 'DELIVERY' && <small>배송비 포함</small>}
      </div>
      <button type="button" className="cart-order-button" disabled={selectedCount === 0} onClick={onOrder}>
        {type === 'PICKUP' ? '픽업 주문하기' : '배달 주문하기'}
      </button>
    </div>
  );
}
