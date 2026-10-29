// 영업 상태 · 재고 상품 수
// 담당: 동균
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';

export default function WishShopCard({ shop, onRemove }) {
  return (
    <article className="wish-shop-card">
      <Link className="wish-shop-link" to={`/stores/${shop.storeId}`} aria-label={`${shop.storeName} 상세 보기`}>
        <div className="wish-shop-thumb">
          {shop.thumbnailUrl ? (
            <img src={shop.thumbnailUrl} alt={shop.storeName} loading="lazy" />
          ) : (
            <span className="wish-thumb-placeholder" />
          )}
        </div>
        <div className="wish-shop-body">
          <div className="wish-shop-title">
            <h2>{shop.storeName}</h2>
            {shop.temporaryClosed && <span className="wish-closed-badge">임시 휴무</span>}
          </div>
          {shop.address && (
            <p className="wish-shop-address">
              <Icon name="pin" size={13} />
              {shop.address}
            </p>
          )}
          <p className="wish-shop-stock">
            재고 있는 상품 <strong>{shop.inStockProductCount}개</strong>
          </p>
          <div className="wish-chips">
            {shop.pickupAvailable && (
              <span className="wish-chip">
                <Icon name="bag" size={13} /> 픽업
              </span>
            )}
            {shop.deliveryAvailable && (
              <span className="wish-chip">
                <Icon name="truck" size={13} /> 배달
              </span>
            )}
          </div>
        </div>
      </Link>
      <button type="button" className="wish-heart" onClick={onRemove} aria-label={`${shop.storeName} 찜 해제`}>
        <Icon name="heart" size={20} fill="currentColor" />
      </button>
    </article>
  );
}
