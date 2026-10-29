// 재고 라벨 · 알림 · 사전예약 버튼
// 담당: 동균
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';

// 이미지를 덮는 상태: 홈·검색·카테고리 카드와 같은 표시
const OVERLAY_LABELS = { soldout: 'SOLD OUT', coming: 'COMING SOON', restock: 'RESTOCK SOON' };

// 재고 상태(stockLabel)는 서버가 계산하므로 입고·재입고·품절이 바뀌면 찜 목록에도 그대로 반영된다.
function overlayOf(item) {
  if (item.stockLabel === 'SOLD_OUT') return 'soldout';
  if (item.stockLabel !== 'INCOMING') return null;
  return item.status === 'UPCOMING' ? 'coming' : 'restock';
}

const OVERLAY_STOCK_TEXTS = { soldout: '품절', coming: '입고 예정', restock: '재입고 예정' };

// 카테고리 상품목록처럼 가격 아래에 빨간 글자로 보여준다.
// 재고가 넉넉하면 표시하지 않고, 10개 이하일 때만 "품절 임박 · N개"를 보여준다.
function stockTextOf(item, overlay) {
  if (overlay) return OVERLAY_STOCK_TEXTS[overlay];
  const inStock = item.stockLabel === 'IN_STOCK' || item.stockLabel === 'LOW_STOCK';
  return inStock && item.stock > 0 && item.stock <= 10 ? `품절 임박 · ${item.stock}개` : null;
}

const won = (value) => `${Number(value ?? 0).toLocaleString('ko-KR')}원`;

export default function WishProductCard({
  item,
  isAdding,
  isAlertPending,
  onRemove,
  onAddToCart,
  onRestockAlert,
  isPreordered,
  isPreorderLoading,
  onPreorder,
}) {
  const overlay = overlayOf(item);
  const stockText = stockTextOf(item, overlay);
  const inStock = item.stockLabel === 'IN_STOCK' || item.stockLabel === 'LOW_STOCK';
  const canAdd = item.addable && (item.pickupAvailable || item.deliveryAvailable);
  // 재입고 알림은 매장 단위(storeProductId)다.
  // TODO: status='UPCOMING' 은 민주님 오픈 알림으로 분기해야 함 (팀 협의 필요)
  const restockButton = (
    <button
      type="button"
      className={`wish-action${item.restockAlertEnabled ? ' is-done' : ''}`}
      disabled={isAlertPending}
      onClick={onRestockAlert}
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
        {overlay && (
          <div className={`wish-dim wish-dim--${overlay}`} aria-hidden="true">
            <span>{OVERLAY_LABELS[overlay]}</span>
          </div>
        )}
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
            <span className="wish-discount">{item.discountRate}%</span>
            <p>
              <strong>{won(item.finalPrice)}</strong>
              <s>{won(item.price)}</s>
            </p>
          </div>
        ) : (
          <div className="wish-price">
            <p>
              <strong>{won(item.price)}</strong>
            </p>
          </div>
        )}
        {stockText && <span className="wish-stock-text">{stockText}</span>}
      </Link>
      <div className="wish-product-actions">
        {inStock && (
          <button
            type="button"
            className="wish-action is-primary"
            disabled={!canAdd || isAdding}
            onClick={onAddToCart}
          >
            {isAdding ? '담는 중…' : '장바구니 담기'}
          </button>
        )}
        {item.stockLabel === 'SOLD_OUT' && restockButton}
        {item.stockLabel === 'INCOMING' && (
          <>
            {restockButton}
            {item.preorderAvailable && (
              <button
                type="button"
                className={`wish-action${isPreordered ? ' is-done' : ' is-primary'}`}
                disabled={isPreordered || isPreorderLoading}
                onClick={onPreorder}
              >
                {isPreordered ? '예약됨' : '사전예약'}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
