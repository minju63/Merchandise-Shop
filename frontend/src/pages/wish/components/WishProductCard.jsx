// 재고 라벨 · 알림 · 사전예약 버튼
// 담당: 동균
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';

const stockBadges = {
  IN_STOCK: { label: '재고 있음', tone: 'green' },
  LOW_STOCK: { label: '품절 임박', tone: 'orange' },
  INCOMING: { label: '입고 예정', tone: 'blue' },
  SOLD_OUT: { label: '품절', tone: 'gray' },
};

const won = (value) => `${Number(value ?? 0).toLocaleString('ko-KR')}원`;

export default function WishProductCard({ item, onRemove, onPending }) {
  const badge = stockBadges[item.stockLabel] ?? stockBadges.SOLD_OUT;
  const inStock = item.stockLabel === 'IN_STOCK' || item.stockLabel === 'LOW_STOCK';
  const restockButton = (
    <button
      type="button"
      className={`wish-action${item.restockAlertEnabled ? ' is-done' : ''}`}
      onClick={onPending}
    >
      {item.restockAlertEnabled ? '알림 신청됨' : '재입고 알림'}
    </button>
  );
  return (
    <article className="wish-product-card">
      <div className="wish-product-thumb">
        <Link to={`/products/${item.storeProductId}`} aria-label={`${item.productName} 상세 보기`}>
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt={item.productName} loading="lazy" />
          ) : (
            <span className="wish-thumb-placeholder" />
          )}
        </Link>
        <span className={`wish-stock-badge is-${badge.tone}`}>{badge.label}</span>
        <button
          type="button"
          className="wish-heart"
          onClick={onRemove}
          aria-label={`${item.productName} 찜 해제`}
        >
          <Icon name="heart" size={20} fill="currentColor" />
        </button>
      </div>
      <Link className="wish-product-body" to={`/products/${item.storeProductId}`}>
        {item.workTitle && <p className="wish-product-work">{item.workTitle}</p>}
        <h2 className="wish-product-name">{item.productName}</h2>
        <p className="wish-product-store">{item.storeName}</p>
        {item.discountRate > 0 ? (
          <div className="wish-price">
            <s>{won(item.price)}</s>
            <p>
              <span className="wish-discount">{item.discountRate}%</span>
              <strong>{won(item.finalPrice)}</strong>
            </p>
          </div>
        ) : (
          <div className="wish-price">
            <p>
              <strong>{won(item.price)}</strong>
            </p>
          </div>
        )}
      </Link>
      <div className="wish-product-actions">
        {inStock && (
          <button type="button" className="wish-action is-primary" disabled={!item.addable} onClick={onPending}>
            장바구니 담기
          </button>
        )}
        {item.stockLabel === 'SOLD_OUT' && restockButton}
        {item.stockLabel === 'INCOMING' && (
          <>
            {restockButton}
            {item.preorderAvailable && (
              <button type="button" className="wish-action is-primary" onClick={onPending}>
                사전예약
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
