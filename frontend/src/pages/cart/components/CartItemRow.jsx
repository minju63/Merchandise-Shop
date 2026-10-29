// 상품 한 줄 — 선택 체크 · 썸네일 · 수량 조절
// 담당: 동균
import { Link } from 'react-router-dom';
import { won } from '../cartFormat.js';

const reasonBadges = {
  OUT_OF_STOCK: '품절',
  NOT_ENOUGH_STOCK: '재고 부족',
  UPCOMING: '입고 예정',
  FULFILLMENT_OFF: '수령 불가',
  STORE_CLOSED: '주문 불가 매장',
  NOT_ON_SALE: '판매 중지',
};

export default function CartItemRow({ item, disabled, onToggle, onQuantity, onRemove }) {
  // 재고 부족 줄은 수량을 줄여서 다시 주문 가능하게 만들 수 있어야 한다.
  const quantityEditable = item.available || item.unavailableReason === 'NOT_ENOUGH_STOCK';
  const maxQuantity = Math.min(item.stock ?? 0, item.maxPerOrder ?? Infinity);
  return (
    <li className={`cart-item${item.available ? '' : ' is-unavailable'}`}>
      <input
        type="checkbox"
        className="cart-check"
        checked={item.isSelected}
        disabled={!item.available || disabled}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={`${item.productName} 선택`}
      />
      <Link className="cart-item-thumb" to={`/products/${item.storeProductId}`}>
        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : <span />}
      </Link>
      <div className="cart-item-body">
        {!item.available && (
          <span className="cart-reason-badge">{reasonBadges[item.unavailableReason] ?? '주문 불가'}</span>
        )}
        {item.workTitle && <p className="cart-item-work">{item.workTitle}</p>}
        <Link className="cart-item-name" to={`/products/${item.storeProductId}`}>
          {item.productName}
        </Link>
        <p className="cart-item-price">
          {item.discountRate > 0 && <span className="cart-discount">{item.discountRate}%</span>}
          <strong>{won(item.finalPrice * item.quantity)}</strong>
          {item.discountRate > 0 && <s className="cart-original-price">{won(item.price * item.quantity)}</s>}
          {item.quantity > 1 && <span className="cart-unit-price">개당 {won(item.finalPrice)}</span>}
        </p>
        {item.unavailableReason === 'NOT_ENOUGH_STOCK' && (
          <p className="cart-item-hint">남은 재고 {item.stock}개 · 수량을 줄이면 주문할 수 있어요</p>
        )}
        <div className="cart-quantity" aria-label="수량">
          <button
            type="button"
            disabled={!quantityEditable || disabled || item.quantity <= 1}
            onClick={() => onQuantity(item.quantity - 1)}
            aria-label="수량 줄이기"
          >
            −
          </button>
          <span>{item.quantity}</span>
          <button
            type="button"
            disabled={!quantityEditable || disabled || item.quantity >= maxQuantity}
            onClick={() => onQuantity(item.quantity + 1)}
            aria-label="수량 늘리기"
          >
            +
          </button>
        </div>
      </div>
      <button
        type="button"
        className="cart-item-remove"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`${item.productName} 삭제`}
      >
        ×
      </button>
    </li>
  );
}
