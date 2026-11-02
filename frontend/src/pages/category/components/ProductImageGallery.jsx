import { useEffect, useRef, useState } from 'react';
import { formatOpenTime } from '../../../utils/openTime.js';

function GalleryImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className="category-image-placeholder" role="img" aria-label={alt}>
        이미지 준비 중
      </div>
    );
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

export default function ProductImageGallery({
  images = [],
  thumbnailUrl,
  productName,
  soldOut = false,
  comingSoon = false,
  upcomingAt,
}) {
  const urls = [
    ...new Set(
      [thumbnailUrl, ...images.map((image) => image.image_url || image.url)].filter(Boolean)
    ),
  ];
  const [selected, setSelected] = useState(0);
  const gesture = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const current = urls[selected] || urls[0];
  const openTimestamp = new Date(upcomingAt).getTime();
  const countdownText = comingSoon && Number.isFinite(openTimestamp) && openTimestamp > currentTimestamp
    ? formatOpenTime(upcomingAt, currentTimestamp).countdownText
    : null;

  useEffect(() => {
    if (!comingSoon || !upcomingAt) return undefined;
    const timer = window.setInterval(() => setCurrentTimestamp(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [comingSoon, upcomingAt]);
  function startDrag(event) {
    if (urls.length < 2 || !event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) setDragOffset(dx);
  }
  function endDrag(event) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const threshold = Math.min(60, event.currentTarget.clientWidth * 0.15);
    if (event.type === 'pointerup' && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
      setSelected((index) => (index + (dx < 0 ? 1 : -1) + urls.length) % urls.length);
    }
    gesture.current = null;
    setDragOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return (
    <section className="category-gallery" aria-label="상품 이미지">
      <div className="category-main-image category-swipe-gallery"
        onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => {
          gesture.current = null;
          setDragOffset(0);
        }} onDragStart={(event) => event.preventDefault()}>
        <div className="category-swipe-image" style={{ transform: `translateX(${dragOffset * 0.35}px)` }}>
          <GalleryImage key={current || 'empty'} src={current} alt={productName} />
        </div>
        {(soldOut || comingSoon) && (
          <div className={`category-soldout-overlay${comingSoon ? ' category-coming-soon-overlay' : ''}`}>
            <span>{comingSoon ? 'COMING SOON' : 'SOLD OUT'}</span>
          </div>
        )}
        {countdownText ? (
          <strong className="category-upcoming-countdown">
            <span aria-hidden="true">◷</span> {countdownText} 후 오픈
          </strong>
        ) : null}
        {urls.length > 0 && (
          <span className={`category-gallery-count${countdownText ? ' has-countdown' : ''}`}>
            {Math.max(1, urls.indexOf(current) + 1)}/{urls.length}
          </span>
        )}
      </div>
      {urls.length > 1 && (
        <div className="category-image-thumbnails">
          {urls.map((url, index) => (
            <button
              type="button"
              key={url}
              aria-pressed={current === url}
              aria-label={`상품 이미지 ${index + 1}`}
              onClick={() => setSelected(index)}
            >
              <GalleryImage src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
