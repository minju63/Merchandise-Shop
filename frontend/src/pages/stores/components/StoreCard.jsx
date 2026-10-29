import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { AvailabilityBadges, ImageWithFallback } from './StoreShell.jsx';
import useWishlist from '../../../hooks/useWishlist.js';

export default function StoreCard({ store }) {
  const wish = useWishlist();
  const wished = wish.isShopWished(store.id);
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
            {store.distanceKm != null && (
              <span className="store-distance"> · {store.distanceKm.toFixed(1)}km</span>
            )}
          </p>
          <p className="category-line">
            {store.categoryNames.length ? store.categoryNames.join(' · ') : '굿즈샵'}
          </p>
          <p className="store-meta">
            <span className="star">★</span> {store.rating ? store.rating.toFixed(1) : '–'}{' '}
            <span className="meta-separator">·</span> 재고 있는 굿즈 {store.availableProductCount}개
          </p>
          <AvailabilityBadges pickup={store.pickupAvailable} delivery={store.deliveryAvailable} />
        </div>
      </Link>
      <button
        className={`card-heart${wished ? ' is-wished' : ''}`}
        type="button"
        aria-pressed={wished}
        aria-label={wished ? `${store.name} 찜 해제` : `${store.name} 찜하기`}
        onClick={() => wish.toggleShop(store.id)}
      >
        <Icon name="heart" size={21} />
      </button>
    </article>
  );
}
