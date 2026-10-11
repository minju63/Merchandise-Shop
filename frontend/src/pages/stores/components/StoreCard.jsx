import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { AvailabilityBadges, ImageWithFallback } from './StoreShell.jsx';

export default function StoreCard({ store }) {
  return (
    <article className="store-card">
      <Link
        className="store-card-link"
        to={`/stores/${store.id}`}
        aria-label={`${store.name} 상세 보기`}
      >
        <ImageWithFallback src={store.images?.[0]} alt={store.name} className="store-card-image" />
        <div className="store-card-content">
          <h2>{store.name}</h2>
          <p className="muted small store-region">
            <Icon name="pin" size={13} />
            {store.region || '지역 정보 없음'}
          </p>
          <p className="category-line">
            {store.categoryNames.length ? store.categoryNames.join(' · ') : '굿즈샵'}
          </p>
          <p className="store-meta">
            <span className="star">★</span> {store.rating ? store.rating.toFixed(1) : '–'}{' '}
            <span className="meta-separator">·</span> 재고 있는 상품 {store.availableProductCount}개
          </p>
          <AvailabilityBadges pickup={store.pickupAvailable} delivery={store.deliveryAvailable} />
        </div>
      </Link>
      {/* TODO: 공통 인증 및 wishlist API가 합쳐지면 store.id로 연결 */}
      <button
        className="card-heart"
        disabled
        title="찜 기능 준비 중"
        aria-label={`${store.name} 찜 기능 준비 중`}
      >
        <Icon name="heart" size={21} />
      </button>
    </article>
  );
}
