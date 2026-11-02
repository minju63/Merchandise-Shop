import { useState } from 'react';
import Icon from './Icon.jsx';
import { AvailabilityBadges } from './StoreShell.jsx';
import { Link, useNavigate } from 'react-router-dom';
import StoreCouponButton from './StoreCouponButton.jsx';

function todayLabel(hour, temporaryClosed) {
  if (temporaryClosed) return '임시 휴무';
  if (!hour) return '영업시간 정보 없음';
  if (hour.is_closed) return '정기 휴무';
  return `${String(hour.open_time).slice(0, 5)} - ${String(hour.close_time).slice(0, 5)}`;
}

export default function StoreInfo({ store, onGuide }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const description = store.description || '';
  return (
    <section className="store-info">
      <div className="store-name-coupon-row"><h1>{store.name}</h1><StoreCouponButton key={store.id} store={store} /></div>
      {store.shortDescription && <p className="short-description">{store.shortDescription}</p>}
      <div className="detail-rating">
        <Link
          className="detail-review-link"
          to={`/stores/${store.id}/reviews`}
          state={{ fromStoreDetail: true }}
          aria-label={`${store.name} 전체 리뷰 ${store.reviewSummary?.totalReviewCount ?? store.reviewCount}개 보기`}
        >
          {store.rating != null && <span className="star">★</span>}
          <strong>가게 평점 {store.rating != null ? store.rating.toFixed(1) : '없음'}</strong>
          <span className="review-count">전체 리뷰 {store.reviewSummary?.totalReviewCount ?? store.reviewCount}개</span>
          <Icon name="right" size={14} />
        </Link>
        <span>재고 있는 굿즈 {store.availableProductCount}개</span>
      </div>
      <div className="info-rows">
        <p>
          <Icon name="pin" size={18} />
          <span>{store.address || '주소 정보 없음'}</span>
        </p>
        <p>
          <Icon name="clock" size={18} />
          <span>
            {todayLabel(store.todayHours, store.temporaryClosed)} · {store.businessStatus}
          </span>
        </p>
      </div>
      <AvailabilityBadges pickup={store.pickupAvailable} delivery={store.deliveryAvailable} />
      {description && (
        <div className="store-description">
          <p className={expanded ? '' : 'clamped'}>{description}</p>
          {description.length > 110 && (
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? '접기' : '더보기'} <Icon name="chevron" size={13} />
            </button>
          )}
        </div>
      )}
      {!description && <p className="muted">매장 설명 정보가 없습니다.</p>}
      <div className="guide-grid">
        {[
          ['pin', '찾아가기', 'location'],
          ['clock', '영업시간', 'hours'],
          ['truck', '배송·픽업 안내', 'fulfillment'],
          ['chat', 'Q&A', 'inquiries'],
        ].map(([icon, label, key]) => (
          <button key={key} onClick={() => key === 'inquiries' ? navigate(`/stores/${store.id}/inquiries`, { state: { fromStoreDetail: true } }) : onGuide(key)}>
            <Icon name={icon} size={23} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
