import { useRef, useState } from 'react';

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
}) {
  const urls = [
    ...new Set(
      [thumbnailUrl, ...images.map((image) => image.image_url || image.url)].filter(Boolean)
    ),
  ];
  const [selected, setSelected] = useState(0);
  const gesture = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const current = urls[selected] || urls[0];
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
        {soldOut && <div className="category-soldout-overlay">SOLD OUT</div>}
        {urls.length > 0 && (
          <span className="category-gallery-count">
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
