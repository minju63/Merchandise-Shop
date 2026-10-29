import { useNavigate } from 'react-router-dom';
import useWishlist from '../hooks/useWishlist.js';
// 이미지를 덮는 상태 표시 글자: 품절 / 출시 예정 / 재입고 예정
const OVERLAY_LABELS = { soldout: 'SOLD OUT', coming: 'COMING SOON', restock: 'RESTOCK SOON' };

function ImagePlaceholder({ label, accent = '#eee8ff' }) {
  return (
    <div className="product-card__image" style={{ '--placeholder-color': accent }} aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="2" />
        <path d="m5.5 17 4.2-4 3.1 2.7 2.3-2.1 3.4 3.4" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

export default function ProductCard({ product, rank, compact = false, onClick }) {
  const wish = useWishlist();
  const navigate = useNavigate();
  const wished = Boolean(product.storeProductId) && wish.isProductWished(product.storeProductId);
  const stockClass = product.stockTone === 'danger' ? ' product-card__stock--danger' : '';

  const handleKeyDown = (event) => {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onClick();
  };

  return (
    <article
      className={`home-product-card${compact ? ' product-card--compact' : ''}${onClick ? ' product-card--clickable' : ''}`}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="product-card__media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <ImagePlaceholder label={product.category} accent={product.accent} />
        )}
        {rank ? <span className="product-card__rank">{rank}</span> : null}
        {product.isNew ? <span className="product-card__new">NEW</span> : null}
        {product.overlay ? (
          <div className={`product-card__dim product-card__dim--${product.overlay}`} aria-hidden="true">
            <span>{OVERLAY_LABELS[product.overlay]}</span>
          </div>
        ) : null}
        {product.upcomingBadge ? (
          <span className={`product-card__upcoming product-card__upcoming--${product.upcomingBadge.type}`}>
            {product.upcomingBadge.label}
          </span>
        ) : null}
        {product.stockLabel ? (
          <span className="product-card__remaining">{product.stockLabel}</span>
        ) : null}
        <button
          className={`product-card__wish${wished ? ' is-wished' : ''}`}
          type="button"
          aria-pressed={wished}
          aria-label={wished ? '찜 해제' : '찜하기'}
          disabled={!product.storeProductId}
          onClick={(event) => {
            // 카드 전체를 누르면 상세로 가므로 하트 클릭은 거기까지 전달하지 않는다.
            // 카테고리 목록처럼 카드가 링크(<a>)로 감싸진 곳에서는 링크 이동도 막아야 한다.
            event.preventDefault();
            event.stopPropagation();
            wish.toggleProduct(product.storeProductId);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.8 4.6a5.4 5.4 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7l1.1 1.1L12 21l7.7-7.6 1.1-1.1a5.4 5.4 0 0 0 0-7.7Z" />
          </svg>
        </button>
      </div>
      <div className="product-card__body">
        {product.openText ? <p className="product-card__open-time">{product.openText}</p> : null}
        <p className="product-card__shop">
          {product.storeId && product.shop ? (
            <button
              type="button"
              className="product-card__shop-link"
              onClick={(event) => {
                // 카드·링크 전체의 상품 상세 이동 대신 굿즈샵으로 보낸다.
                event.preventDefault();
                event.stopPropagation();
                navigate(`/stores/${encodeURIComponent(product.storeId)}`);
              }}
            >
              {product.shop}
            </button>
          ) : product.shop}
        </p>
        {(product.goodsCategoryName || product.category || product.workTitle) ? (
          <p className="product-card__work-title">
            {product.goodsCategoryName || product.category || product.workTitle}
          </p>
        ) : null}
        <h3>{product.name}</h3>
        {product.discountRate ? (
          <>
            <p className="product-card__discount"><b>{product.discountRate}%</b></p>
            <p className="product-card__price-row">
              <strong>{product.price}</strong>
              <s>{product.originalPrice}</s>
            </p>
          </>
        ) : (
          <strong>{product.price}</strong>
        )}
        {product.stockText || product.shipping ? (
          <div className="product-card__meta">
            {product.stockText ? <span className={`product-card__stock${stockClass}`}>{product.stockText}</span> : null}
            {product.shipping ? <span>{product.shipping}</span> : null}
          </div>
        ) : null}
        {product.openAt ? <p className="product-card__open">{product.openAt}</p> : null}
      </div>
    </article>
  );
}
