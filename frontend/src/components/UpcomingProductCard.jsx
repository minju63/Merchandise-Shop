import { formatOpenTime } from '../utils/openTime.js';

export default function UpcomingProductCard({
  product,
  currentTimestamp,
  isAlerted = false,
  alertActionAvailable = false,
  onAlertClick,
  onClick,
}) {
  const openTime = formatOpenTime(product.openAt, currentTimestamp);

  return (
    <article
      className={`upcoming-card${onClick ? ' upcoming-card--clickable' : ''}`}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onClick();
      }}
    >
      <div className="upcoming-card__media" style={{ '--placeholder-color': product.accent }}>
        {product.imageUrl ? (
          <img className="upcoming-card__image" src={product.imageUrl} alt={product.name} draggable="false" />
        ) : null}
        <div className="product-card__dim" aria-hidden="true">
          <span>{product.openType === 'RESTOCK' ? 'RESTOCK SOON' : 'COMING SOON'}</span>
        </div>
        <span className={`upcoming-card__type upcoming-card__type--${product.openType.toLowerCase()}`}>
          {product.openType === 'RESTOCK' ? '재입고 예정' : '출시 예정'}
        </span>
        {product.imageUrl ? null : (
          <>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="2" />
              <path d="m5.5 17 4.2-4 3.1 2.7 2.3-2.1 3.4 3.4" />
            </svg>
            <span>{product.category}</span>
          </>
        )}
        {openTime.countdownText ? (
          <strong className="upcoming-card__countdown">
            <span aria-hidden="true">◷</span> {openTime.countdownText} 후 오픈
          </strong>
        ) : null}
      </div>
      <div className="upcoming-card__body">
        <p className="upcoming-card__open">{openTime.text}</p>
        <p className="upcoming-card__shop">{product.shop}</p>
        <h3>{product.name}</h3>
        <strong className="upcoming-card__price">{product.price}</strong>
        <button
          className={isAlerted ? 'upcoming-card__alert active' : 'upcoming-card__alert'}
          type="button"
          disabled={!alertActionAvailable}
          onClick={(event) => {
            event.stopPropagation();
            onAlertClick?.(product);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
          {isAlerted ? '알림 신청 완료' : '알림 받기'}
        </button>
        <p className="upcoming-card__waiting">
          {product.alertCount.toLocaleString('ko-KR')}명이 기다려요
        </p>
      </div>
    </article>
  );
}
