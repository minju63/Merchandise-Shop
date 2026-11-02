// 매장별 묶음 + 매장 합계
// 담당: 동균
import Icon from '../../../components/Icon.jsx';
import CartItemRow from './CartItemRow.jsx';
import { won } from '../cartFormat.js';

function DeliveryFee({ store, itemsSum, toFree }) {
  if (store.baseDeliveryFee === null) return <span>배송비 정보 없음</span>;
  // 상품 합계가 무료배송 기준을 넘어 배송비가 빠진 경우
  if (store.baseDeliveryFee > 0 && itemsSum > 0 && toFree === 0)
    return (
      <span>
        <s>{won(store.baseDeliveryFee)}</s> → <strong className="cart-free">무료</strong>
      </span>
    );
  return <span>{won(itemsSum > 0 ? store.baseDeliveryFee : 0)}</span>;
}

export default function CartStoreGroup({
  store,
  type,
  disabled,
  couponAssignment,
  couponCount,
  couponState,
  onCoupon,
  onToggle,
  onQuantity,
  onRemove,
}) {
  const isDelivery = type === 'DELIVERY';
  // 아무것도 선택하지 않았어도 상품 합계에는 담긴 상품 가격을 보여준다.
  const itemsSum =
    store.itemsTotal > 0
      ? store.itemsTotal
      : store.items
          .filter((item) => item.available)
          .reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  const toFree =
    store.freeThreshold === null || store.freeThreshold === undefined
      ? null
      : Math.max(store.freeThreshold - itemsSum, 0);
  return (
    <section className="cart-store">
      <header className="cart-store-header">
        <Icon name="store" size={18} />
        <h2>{store.storeName}</h2>
        {store.temporaryClosed && <span className="cart-closed-badge">임시 휴무</span>}
      </header>
      {isDelivery && store.baseDeliveryFee !== null && (
        <p className="cart-store-delivery">
          <Icon name="truck" size={14} />
          기본 배송비 {won(store.baseDeliveryFee)}
          {store.freeThreshold !== null && ` · ${won(store.freeThreshold)} 이상 무료`}
          {store.estimatedDays !== null && ` · 약 ${store.estimatedDays}일 소요`}
        </p>
      )}
      <ul className="cart-items">
        {store.items.map((item) => (
          <CartItemRow
            key={item.cartItemId}
            item={item}
            disabled={disabled}
            onToggle={(checked) => onToggle(item, checked)}
            onQuantity={(quantity) => onQuantity(item, quantity)}
            onRemove={() => onRemove(item)}
          />
        ))}
      </ul>
      <button
        type="button"
        className="cart-store-coupon"
        disabled={disabled || store.itemsTotal <= 0}
        onClick={onCoupon}
      >
        <span className="cart-store-coupon__text">
          <strong>쿠폰</strong>
          <small>
            {store.itemsTotal <= 0
              ? '상품을 선택하면 쿠폰을 사용할 수 있어요'
              : couponState === 'error' ? '쿠폰 조회 실패 · 다시 시도'
                : couponState === 'loading' ? '쿠폰 불러오는 중'
                  : couponAssignment?.couponName ?? (couponCount ? `사용 가능 ${couponCount}장` : '사용 가능한 쿠폰 없음')}
          </small>
        </span>
        <span className="cart-store-coupon__action">
          {couponAssignment ? <em>-{won(couponAssignment.discountAmount)}</em> : null}
          <span className="cart-store-coupon__pick">{couponAssignment ? '변경' : '선택'}</span>
          <b aria-hidden="true">›</b>
        </span>
      </button>
      {isDelivery && toFree > 0 && (
        <p className="cart-free-hint">{won(toFree)} 더 담으면 무료배송</p>
      )}
      <dl className="cart-store-summary">
        <div>
          <dt>상품 합계</dt>
          <dd>{won(itemsSum)}</dd>
        </div>
        {isDelivery && (
          <div>
            <dt>배송비</dt>
            <dd>
              <DeliveryFee store={store} itemsSum={itemsSum} toFree={toFree} />
            </dd>
          </div>
        )}
        <div>
          <dt>쿠폰 할인</dt>
          <dd className={couponAssignment ? 'cart-store-summary__discount' : ''}>
            {couponAssignment ? `-${won(couponAssignment.discountAmount)}` : won(0)}
          </dd>
        </div>
        <div className="cart-store-total">
          <dt>샵 주문 결제 금액</dt>
          <dd>{won(Math.max(store.storeTotal - (couponAssignment?.discountAmount ?? 0), 0))}</dd>
        </div>
      </dl>
    </section>
  );
}
