import { won } from '../cartFormat.js';

function goodsPickRate(amount) {
  if (amount >= 100000) return 1.5;
  if (amount >= 50000) return 1;
  if (amount >= 30000) return 0.5;
  if (amount >= 20000) return 0.3;
  return 0;
}

export default function CartOrderSummary({ cart, items, type, couponDiscount }) {
  const selected = items.filter((item) => item.available && item.isSelected);
  const originalAmount = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const productDiscount = Math.max(originalAmount - cart.itemsTotal, 0);
  const finalAmount = Math.max(cart.grandTotal - couponDiscount, 0);
  const basicReward = Math.floor(finalAmount * 0.01);
  const accountRate = goodsPickRate(cart.itemsTotal);
  const accountExtra = Math.floor(cart.itemsTotal * accountRate * 0.01);
  const isFreeDelivery = type === 'PICKUP' || cart.deliveryFeeTotal === 0;

  return (
    <section className="cart-order-summary" aria-labelledby="cart-order-summary-title">
      <h2 id="cart-order-summary-title">결제 전 최종 확인</h2>
      <dl className="cart-order-summary__prices">
        <div>
          <dt>총 상품금액</dt>
          <dd>{won(originalAmount)}</dd>
        </div>
        <div>
          <dt>상품할인</dt>
          <dd>{productDiscount > 0 ? `-${won(productDiscount)}` : won(0)}</dd>
        </div>
        <div>
          <dt>쿠폰할인</dt>
          <dd className={couponDiscount > 0 ? 'cart-order-summary__discount' : ''}>
            {couponDiscount > 0 ? `-${won(couponDiscount)}` : won(0)}
          </dd>
        </div>
        <div>
          <dt>배송비</dt>
          <dd className={isFreeDelivery ? 'is-free' : ''}>
            {isFreeDelivery ? '무료배송' : won(cart.deliveryFeeTotal)}
          </dd>
        </div>
      </dl>

      <div className="cart-order-summary__promo">
        <span>최대 1.5% 추가 적립</span>
        <p>굿즈픽페이 계좌 간편결제로 결제해 보세요</p>
      </div>

      <div className="cart-order-summary__benefits">
        <h3>예상 적립 혜택</h3>
        <div>
          <span><i aria-hidden="true">P</i> 기본 적립</span>
          <strong>{won(basicReward)}</strong>
        </div>
        <div>
          <span><i aria-hidden="true">+</i> 계좌 결제 추가 적립 {accountRate > 0 ? `${accountRate}%` : ''}</span>
          <strong>{accountRate > 0 ? won(accountExtra) : '2만원부터'}</strong>
        </div>
        <small>굿즈픽페이 적립금은 전체 주문상품 구매확정 시 지급돼요.</small>
      </div>

      <div className="cart-order-summary__total">
        <span>예상 결제금액</span>
        <strong>{won(finalAmount)}</strong>
      </div>
    </section>
  );
}
