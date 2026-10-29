// 매장별 묶음 + 매장 합계
// 담당: 동균
import Icon from '../../../components/Icon.jsx';
import CartItemRow from './CartItemRow.jsx';
import { won } from '../cartFormat.js';

function DeliveryFee({ store }) {
  if (store.baseDeliveryFee === null) return <span>배송비 정보 없음</span>;
  // 선택 상품이 무료배송 기준을 넘어 배송비가 빠진 경우
  if (store.deliveryFee === 0 && store.baseDeliveryFee > 0 && store.itemsTotal > 0 && store.amountToFreeShipping === 0)
    return (
      <span>
        <s>{won(store.baseDeliveryFee)}</s> → <strong className="cart-free">무료</strong>
      </span>
    );
  return <span>{won(store.deliveryFee)}</span>;
}

export default function CartStoreGroup({ store, type, disabled, onToggle, onQuantity, onRemove }) {
  const isDelivery = type === 'DELIVERY';
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
      {isDelivery && store.amountToFreeShipping > 0 && (
        <p className="cart-free-hint">{won(store.amountToFreeShipping)} 더 담으면 무료배송</p>
      )}
      <dl className="cart-store-summary">
        <div>
          <dt>상품 합계</dt>
          <dd>{won(store.itemsTotal)}</dd>
        </div>
        {isDelivery && (
          <div>
            <dt>배송비</dt>
            <dd>
              <DeliveryFee store={store} />
            </dd>
          </div>
        )}
        <div className="cart-store-total">
          <dt>매장 합계</dt>
          <dd>{won(store.storeTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}
