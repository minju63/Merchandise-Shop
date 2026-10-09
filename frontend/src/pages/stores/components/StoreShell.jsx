import { Link } from 'react-router-dom';
import { useState } from 'react';
import Icon from './Icon.jsx';

export function StoreHeader({ back = false, searchContext = null }) {
  return (
    <header className="store-header">
      <div className="store-header-main">
        {back ? (
          <Link className="icon-button" to="/stores" aria-label="굿즈샵 목록으로">
            <Icon name="back" />
          </Link>
        ) : (
          <h1>굿즈샵</h1>
        )}
      </div>
      <div className="store-header-actions">
        {/* TODO(search): 공용 검색 경로 확정 후 searchContext의 storeId, storeName을 전달 */}
        {!back && (
          <button
            className="icon-button"
            disabled
            data-store-id={searchContext?.storeId}
            data-store-name={searchContext?.storeName}
            title="검색 화면 준비 중"
            aria-label="검색 준비 중"
          >
            <Icon name="search" />
          </button>
        )}
        <button
          className="icon-button"
          disabled
          title="알림 화면 준비 중"
          aria-label="알림 준비 중"
        >
          <Icon name="bell" />
        </button>
        <button
          className="icon-button"
          disabled
          title="장바구니 화면 준비 중"
          aria-label="장바구니 준비 중"
        >
          <Icon name="cart" />
        </button>
      </div>
    </header>
  );
}

export function TabBar() {
  const tabs = [
    ['home', '홈'],
    ['store', '굿즈샵'],
    ['grid', '카테고리'],
    ['heart', '찜'],
    ['user', '마이'],
  ];
  return (
    <nav className="tab-bar" aria-label="하단 메뉴">
      {tabs.map(([icon, label]) =>
        label === '굿즈샵' ? (
          <Link className="tab-item active" to="/stores" key={label}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </Link>
        ) : (
          <button className="tab-item" disabled title={`${label} 화면 준비 중`} key={label}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </button>
        )
      )}
    </nav>
  );
}

export function PageState({ children, onRetry }) {
  return (
    <div className="page-state">
      <span className="state-illustration">
        <Icon name="store" size={32} />
      </span>
      <p>{children}</p>
      {onRetry && (
        <button className="secondary-button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function ImageWithFallback({ src, alt = '', className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  return (
    <div className={`image-frame ${className}`}>
      {src && failedSrc !== src ? (
        <img key={src} src={src} alt={alt} onError={() => setFailedSrc(src)} />
      ) : (
        <span className="image-fallback">
          <Icon name="image" size={30} />
        </span>
      )}
    </div>
  );
}

export function AvailabilityBadges({ pickup, delivery }) {
  return (
    <div className="availability-badges">
      {pickup && (
        <span>
          <Icon name="bag" size={14} /> 픽업 가능
        </span>
      )}
      {delivery && (
        <span>
          <Icon name="truck" size={15} /> 배달 가능
        </span>
      )}
    </div>
  );
}
