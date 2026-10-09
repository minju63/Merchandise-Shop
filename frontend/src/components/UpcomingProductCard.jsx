const pad = (value) => String(value).padStart(2, '0');

function getTimeParts(date) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function formatOpenTime(openAt, currentTimestamp) {
  const openTimestamp = new Date(openAt).getTime();
  const remaining = openTimestamp - currentTimestamp;
  const parts = getTimeParts(new Date(openAt));
  const currentParts = getTimeParts(new Date(currentTimestamp));
  const isToday = parts.year === currentParts.year
    && parts.month === currentParts.month
    && parts.day === currentParts.day;
  const text = isToday
    ? `오늘 ${parts.hour}:${parts.minute} 오픈`
    : `${parts.month}.${parts.day} (${parts.weekday}) ${parts.hour}:${parts.minute} 오픈`;

  if (isToday) {
    const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { text, countdownText: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
  }

  return { text, countdownText: null };
}

export default function UpcomingProductCard({
  product,
  currentTimestamp,
  isAlerted = false,
  alertActionAvailable = false,
  onAlertClick,
}) {
  const openTime = formatOpenTime(product.openAt, currentTimestamp);

  return (
    <article className="upcoming-card">
      <div className="upcoming-card__media" style={{ '--placeholder-color': product.accent }}>
        <span className={`upcoming-card__type upcoming-card__type--${product.openType.toLowerCase()}`}>
          {product.openType === 'RESTOCK' ? '재입고 예정' : '출시 예정'}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="2" />
          <path d="m5.5 17 4.2-4 3.1 2.7 2.3-2.1 3.4 3.4" />
        </svg>
        <span>{product.category}</span>
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
          onClick={() => onAlertClick?.(product)}
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
